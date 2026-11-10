import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openMerchantLimits, WINDOW_SECONDS, REQUEST_LIMITS } from '../../src/features/guest-cart/merchant-limits.server.js';
import { admitMerchantCheckout, MERCHANT_PEER_HEADER } from '../../src/features/guest-cart/merchant-admission.js';
const roots: string[] = [], stores: ReturnType<typeof openMerchantLimits>[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'brb-admission-')); roots.push(root);
  const path = join(root, 'limits.db'), key = new Uint8Array(32).fill(7);
  const open = () => { const store = openMerchantLimits(path, key); stores.push(store); return store; };
  return { path, key, open, store: open() };
}
const path = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare';
function request(extra: Record<string, string> = {}, body = '{}') {
  return new Request('https://backroadbum.com' + path, { method: 'POST', headers: {
    origin: 'https://backroadbum.com', 'content-type': 'application/json', [MERCHANT_PEER_HEADER]: '192.0.2.1', ...extra,
  }, body });
}
describe('durable merchant request limits', () => {
  it('bounds prepares and starts independently, preserving counters across recreation', () => {
    const { store, open } = setup();
    for (let i = 0; i < REQUEST_LIMITS.start.visitor; i++) expect(store.take('start', '192.0.2.1', 1201).allowed).toBe(true);
    expect(open().take('start', '192.0.2.1', 1201)).toEqual({ allowed: false, retryAfter: 599 });
    expect(store.take('prepare', '192.0.2.1', 1201).allowed).toBe(true);
    expect(store.take('status', '192.0.2.1', 1201).allowed).toBe(true);
    expect(store.take('start', '192.0.2.2', 1201).allowed).toBe(true);
    expect(store.take('start', '192.0.2.1', 1801).allowed).toBe(true);
  });
  it('caps the whole store even when every peer is different; blocked peers do not add rows', () => {
    const { store, path } = setup();
    for (let i = 1; i <= REQUEST_LIMITS.start.global; i++) expect(store.take('start', `192.0.2.${i}`, 1201).allowed).toBe(true);
    expect(store.take('start', '198.51.100.1', 1201).allowed).toBe(false);
    const db = new DatabaseSync(path, { readOnly: true });
    try { expect(db.prepare('SELECT COUNT(*) AS n FROM request_windows').get()?.n).toBe(21); } finally { db.close(); }
  });
  it('purges expired HMAC buckets and never writes raw addresses', () => {
    const { store, path } = setup();
    store.take('prepare', '2001:db8::1', 1201); store.take('prepare', '2001:db8::1', 1801);
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      const rows = db.prepare('SELECT * FROM request_windows').all();
      expect(rows).toHaveLength(2); expect(rows.every(row => row.window === 1800)).toBe(true);
      expect(JSON.stringify(rows)).not.toContain('2001:db8');
    } finally { db.close(); }
    expect(readFileSync(path).includes(Buffer.from('2001:db8'))).toBe(false);
  });
  it('shares atomic counters between two open connections and refuses malformed context or clock rollback', () => {
    const { store, open } = setup(), other = open();
    store.take('start', '192.0.2.1', 1201); other.take('start', '192.0.2.1', 1201); store.take('start', '192.0.2.1', 1201);
    expect(other.take('start', '192.0.2.1', 1201).allowed).toBe(false);
    expect(() => store.take('start', 'not-an-ip', 1201)).toThrow();
    expect(() => store.take('start', '192.0.2.1', 1201 - WINDOW_SECONDS)).toThrow();
    expect(() => openMerchantLimits(':memory:', new Uint8Array(0))).toThrow();
  });
});
describe('merchant HTTP admission before Commerce', () => {
  it('allows a bounded, same-origin JSON request but does not consume its original body', async () => {
    const take = vi.fn(() => ({ allowed: true, retryAfter: 100 })); const req = request();
    expect(await admitMerchantCheckout(req, path, take)).toBeNull();
    expect(take).toHaveBeenCalledWith('prepare', '192.0.2.1'); expect(await req.text()).toBe('{}');
  });
  it('rejects foreign origin, fetch context, media type, oversized and invalid bodies before any counter write', async () => {
    const take = vi.fn(() => ({ allowed: true, retryAfter: 100 }));
    const cases: [Request, number][] = [[request({ origin: 'https://foreign.test' }), 403],
      [request({ 'sec-fetch-site': 'cross-site' }), 403], [request({ 'content-type': 'text/plain' }), 415],
      [request({}, 'x'.repeat(4097)), 413], [request({}, '{"amount":1}'), 400], [request({}, 'invalid'), 400]];
    for (const [req, status] of cases) expect((await admitMerchantCheckout(req, path, take))?.status).toBe(status);
    expect(take).not.toHaveBeenCalled();
  });
  it('fails closed without proxy identity or when its durable store is unavailable', async () => {
    const req = request(); req.headers.delete(MERCHANT_PEER_HEADER);
    expect((await admitMerchantCheckout(req, path))?.status).toBe(503);
    expect((await admitMerchantCheckout(request(), path, () => { throw Error('offline'); }))?.status).toBe(503);
  });
  it('returns retryable rate refusal with no authority from spoofed forwarding headers', async () => {
    const take = vi.fn(() => ({ allowed: false, retryAfter: 123 }));
    const response = await admitMerchantCheckout(request({ 'x-forwarded-for': '203.0.113.1', 'cf-connecting-ip': '203.0.113.2' }), path, take);
    expect(take).toHaveBeenCalledWith('prepare', '192.0.2.1');
    expect(response?.status).toBe(429); expect(response?.headers.get('Retry-After')).toBe('123');
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
  });
  it('status recovery uses its separate budget; GET readiness never takes a checkout budget', async () => {
    const take = vi.fn(() => ({ allowed: true, retryAfter: 100 }));
    expect(await admitMerchantCheckout(request(), '/api/checkout/status', take)).toBeNull();
    expect(take).toHaveBeenCalledWith('status', '192.0.2.1'); take.mockClear();
    expect(await admitMerchantCheckout(new Request('https://backroadbum.com'), path.replace('prepare', 'readiness'), take)).toBeNull();
    expect(take).not.toHaveBeenCalled();
  });
});
