import { describe, expect, it, vi } from 'vitest';
import { readRetainedReceipt } from '../../src/features/guest-cart/retained-receipt.js';
import { GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY } from '../../src/features/guest-cart/checkout-protocol.js';

const retained = JSON.stringify({ capabilityId: 'original', capability: 'original.secret', attemptId: 'attempt-old' });
const checkout = {
  schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'paid', attemptId: 'attempt-old',
  redirectUrl: null, retryAfter: null,
  order: { orderId: 'order:old', receiptId: 'receipt:old', lines: [{ catalogItemId: 'mug', name: 'Frozen mug', quantity: 2, unitPrice: { currency: 'USD', minor: '1600' } }], total: { currency: 'USD', minor: '3200' } },
};
const response = (patch = {}, status = 200) => Response.json({ ok: true, capabilityId: 'original', checkout: { ...checkout, ...patch } }, { status });
const storage = (raw: string | null = retained) => ({ getItem: vi.fn(() => raw), setItem: vi.fn(), removeItem: vi.fn() });

describe('read-only merchant retained receipt handoff', () => {
  it('reads only the original status capability and locator; preserves storage byte for byte', async () => {
    const saved = storage(); const fetch = vi.fn(async () => response());
    const result = await readRetainedReceipt(saved, { fetch });
    expect(result.kind).toBe('paid');
    if (result.kind === 'paid') expect(result.order.totals).toEqual([{ label: 'Total', amount: '$32.00' }]);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/checkout/status'); expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('x-commerce-guest-capability')).toBe('original.secret');
    expect(init.body).toBe('{"attemptId":"attempt-old"}');
    expect(init.cache).toBe('no-store'); expect(init.redirect).toBe('error');
    expect(saved.getItem).toHaveBeenCalledWith(GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY);
    expect(saved.setItem).not.toHaveBeenCalled(); expect(saved.removeItem).not.toHaveBeenCalled();
  });
  it.each([null, '', '{invalid', '{}', 'x'.repeat(4097)])('never prepares or starts when saved state is missing/invalid: %s', async raw => {
    const fetch = vi.fn(); const saved = storage(raw);
    expect((await readRetainedReceipt(saved, { fetch })).kind).toBe(raw ? 'unavailable' : 'missing');
    expect(fetch).not.toHaveBeenCalled(); expect(saved.setItem).not.toHaveBeenCalled();
  });
  it('fails closed on blocked storage', async () => {
    const fetch = vi.fn();
    expect((await readRetainedReceipt({ getItem: () => { throw new Error('blocked'); } }, { fetch })).kind).toBe('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(['pending', 'recoverable-failure', 'released-retry'])('does not call %s a paid order or offer a replacement start', async state => {
    const fetch = vi.fn(async () => response({ state, order: null, retryAfter: state === 'released-retry' ? 'attempt-old' : null }));
    expect((await readRetainedReceipt(storage(), { fetch })).kind).toBe('unconfirmed'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('uses an awaiting-start original capability without inventing an attempt', async () => {
    const saved = storage(JSON.stringify({ capabilityId: 'original', capability: 'original.secret', attemptId: null, awaitingStart: true }));
    const fetch = vi.fn(async () => response({ state: 'pending', order: null }));
    expect((await readRetainedReceipt(saved, { fetch })).kind).toBe('unconfirmed');
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body).toBe('{}');
    expect(saved.setItem).not.toHaveBeenCalled();
  });
  it('rejects a different attempt, capability, malformed response and refused read', async () => {
    for (const reply of [response({ attemptId: 'another' }), Response.json({ ok: true, capabilityId: 'another', checkout }), Response.json({}), response({}, 503)]) {
      expect((await readRetainedReceipt(storage(), { fetch: async () => reply })).kind).toBe('unavailable');
    }
  });
  it('refuses a stale paid response if another tab clears or changes retention', async () => {
    for (const changed of [null, '{}', retained + ' ']) {
      const saved = storage();
      const result = await readRetainedReceipt(saved, { fetch: async () => { saved.getItem.mockReturnValue(changed); return response(); } });
      expect(result.kind).toBe('changed'); expect(saved.setItem).not.toHaveBeenCalled();
    }
  });
});
