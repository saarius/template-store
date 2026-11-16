import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isPublicTrafficPage, qualifiesTraffic } from '../../src/features/experiment-report/traffic-policy.js';
import { openTrafficLedger, observeStoreTraffic, createTrafficObserver } from '../../src/features/experiment-report/traffic-ledger.server.js';

const browser = { 'user-agent': 'Mozilla/5.0 Test Browser Safari/537.36', accept: 'text/html', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
const request = (path = '/shop', headers = {}, method = 'GET') => new Request(`https://backroadbum.com${path}`, { headers: { ...browser, ...headers }, method });
const html = () => new Response('No request data is kept', { headers: { 'content-type': 'text/html; charset=utf-8' } });
let dirs: string[] = [];
afterEach(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); dirs = []; });
const path = () => { const dir = mkdtempSync(join(tmpdir(), 'backroad-traffic-')); dirs.push(dir); return join(dir, 'traffic.db'); };

describe('privacy-preserving traffic policy', () => {
  it.each(['/', '/shop', '/products/creekside-camp-mug', '/categories/road-day', '/field-notes', '/field-note-wet-gear-reset', '/cart', '/checkout', '/account', '/search', '/dashboard/history'])('recognizes public page %s', path => {
    expect(isPublicTrafficPage(path)).toBe(true); expect(qualifiesTraffic(request(path), html())).toBe(true);
  });
  it.each(['/_emdash/admin', '/_emdash/api/plugins/x/store-proof', '/api/checkout/status', '/proof', '/pr-proof/picture.png', '/feeds/agent-catalog.json', '/backroad/fonts/font.woff2', '/made-up', '/products/%2fadmin'])('excludes non-page %s', path => {
    expect(qualifiesTraffic(request(path), html())).toBe(false);
  });
  it.each(['', 'curl/8', 'python-urllib', 'BackroadBum-SelfCheck/1.0', 'Mozilla/5.0 HeadlessChrome/120', 'Mozilla/5.0 Googlebot/2.1', 'Mozilla/5.0 GPTBot', 'Mozilla/5.0 Playwright', 'Mozilla/5.0 Lighthouse', 'Mozilla/5.0 ClaudeBot'])('excludes missing/automated agent %s', agent => {
    expect(qualifiesTraffic(request('/shop', { 'user-agent': agent }), html())).toBe(false);
  });
  it.each([{ 'sec-fetch-dest': 'empty' }, { 'sec-fetch-mode': 'cors' }, { accept: 'application/json' }, { purpose: 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' }, { 'x-backroadbum-self-check': '1' }])('excludes non-navigation/prefetch/self-check %j', headers => {
    expect(qualifiesTraffic(request('/shop', headers), html())).toBe(false);
  });
  it('excludes editor/preview and explicitly authorized operator requests', () => {
    for (const path of ['/shop?_preview=private-synthetic', '/shop?_edit']) expect(qualifiesTraffic(request(path), html())).toBe(false);
    for (const headers of [{ authorization: 'Basic synthetic' }, { cookie: 'other=value; emdash-edit-mode=true' }]) {
      expect(qualifiesTraffic(request('/shop', headers), html())).toBe(false);
    }
  });
  it('requires canonical host, GET and a successful HTML response', () => {
    expect(qualifiesTraffic(new Request('https://other.example/shop', { headers: browser }), html())).toBe(false);
    for (const method of ['POST', 'HEAD']) expect(qualifiesTraffic(request('/shop', {}, method), html())).toBe(false);
    for (const status of [201, 301, 401, 404, 429, 503]) expect(qualifiesTraffic(request(), new Response(null, { status, headers: { 'content-type': 'text/html' } }))).toBe(false);
    expect(qualifiesTraffic(request(), Response.json({}))).toBe(false);
  });
});

describe('bounded operational ledger', () => {
  it('keeps only daily counters, persists across reopen and never retains URL/contact/UA/IP/cookies', () => {
    const file = path(), now = new Date('2026-11-16T12:00:00.000Z');
    let ledger = openTrafficLedger(file);
    const req = request('/search?q=private-synthetic-query', { cookie: 'private-synthetic-cookie', referer: 'https://private.example/', 'x-forwarded-for': '192.0.2.99' });
    ledger.observe(req, html(), now); ledger.observe(req, html(), now);
    ledger.observe(request('/shop', { 'x-backroadbum-self-check': '1' }), html(), now);
    ledger.close(); ledger = openTrafficLedger(file); ledger.observe(req, html(), now); ledger.close();
    const db = new DatabaseSync(file, { readOnly: true });
    expect(db.prepare('SELECT * FROM traffic_days').all()).toEqual([{ day: '2026-11-16', responses: 3 }]);
    expect(db.prepare('PRAGMA table_info(traffic_days)').all().map(x => x.name)).toEqual(['day', 'responses']);
    expect(db.prepare('SELECT * FROM traffic_meta').all()).toEqual([{ id: 1, schema: 'backroadbum.traffic/v1', since: now.toISOString(), heartbeat: now.toISOString() }]);
    db.close(); expect(statSync(file).mode & 0o777).toBe(0o600);
    const bytes = readFileSync(file).toString();
    for (const secret of ['private-synthetic', '192.0.2.99', 'Test Browser', 'private.example', '/search']) expect(bytes).not.toContain(secret);
  });
  it('initializes a real zero from excluded health requests and purges beyond 90 UTC days', () => {
    const file = path(), ledger = openTrafficLedger(file);
    ledger.observe(request('/shop', { 'user-agent': 'BackroadBum-SelfCheck/1.0' }), html(), new Date('2026-01-01T00:00:00Z'));
    const db = new DatabaseSync(file); expect(db.prepare('SELECT * FROM traffic_days').all()).toEqual([]);
    ledger.observe(request(), html(), new Date('2026-01-01T00:01:00Z'));
    ledger.observe(request(), html(), new Date('2026-03-31T00:00:00Z'));
    ledger.observe(request(), html(), new Date('2026-04-01T00:00:00Z'));
    expect(db.prepare('SELECT day FROM traffic_days ORDER BY day').all()).toEqual([{ day: '2026-03-31' }, { day: '2026-04-01' }]);
    db.close(); ledger.close();
  });
  it('refuses backwards clocks and unknown state without resetting counters', () => {
    const file = path(), ledger = openTrafficLedger(file), now = new Date('2026-11-16T12:00:00Z');
    ledger.observe(request(), html(), now);
    expect(() => ledger.observe(request(), html(), new Date('2026-11-15'))).toThrow();
    const db = new DatabaseSync(file); db.exec("UPDATE traffic_meta SET schema='future'");
    expect(() => ledger.observe(request(), html(), new Date('2026-11-17'))).toThrow();
    expect(db.prepare('SELECT responses FROM traffic_days').get()?.responses).toBe(1);
    db.close(); ledger.close();
  });
  it('never fails serving on open/write/close errors and retries only after its cooldown', () => {
    let now = 100_000;
    const close = vi.fn(() => { throw Error('synthetic close failure'); });
    const open = vi.fn().mockImplementationOnce(() => { throw Error('synthetic open failure'); })
      .mockReturnValue({ observe: () => { throw Error('synthetic write failure'); }, close });
    const observe = createTrafficObserver(open, () => now);
    const response = html();
    expect(() => observe(request(), response)).not.toThrow();
    observe(request(), response); expect(open).toHaveBeenCalledTimes(1);
    now += 60_000;
    expect(() => observe(request(), response)).not.toThrow();
    expect(open).toHaveBeenCalledTimes(2); expect(close).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });
  it('does not erase a corrupt file and is inert without explicit serving opt-in', () => {
    const file = path(); writeFileSync(file, 'not a database');
    expect(() => openTrafficLedger(file)).toThrow(); expect(readFileSync(file, 'utf8')).toBe('not a database');
    const source = readFileSync(new URL('../../src/middleware.ts', import.meta.url), 'utf8');
    expect(source).toContain('!isCloudflare && !isProofMode && !isPlayground');
    expect(() => observeStoreTraffic(request(), html())).not.toThrow();
  });
});
