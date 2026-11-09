import { describe, expect, it, vi } from 'vitest';
import { operatorCheckout } from '../../src/features/guest-cart/operator-checkout.js';
const request = (body: unknown = { action: 'prepare', input: {} }, origin = 'https://backroadbum.com') => new Request('https://backroadbum.com/api/operator/checkout', {
  method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body),
});
describe('private operator checkout dispatcher', () => {
  it('refuses anonymous, non-admin and cross-origin callers before dispatch', async () => {
    const dispatch = vi.fn();
    for (const user of [null, {}, { role: 40 }, { role: '50' }]) expect((await operatorCheckout(request(), user, dispatch)).status).toBe(401);
    expect((await operatorCheckout(request(undefined, 'https://other.invalid'), { role: 50 }, dispatch)).status).toBe(403);
    expect(dispatch).not.toHaveBeenCalled();
  });
  it('can only invoke the installed canonical guest routes with the same capability', async () => {
    const dispatch = vi.fn(async (id: string, method: string, path: string, forwarded: Request) => {
      expect(id).toBe('r_gshdrqaldna3r7sn'); expect(method).toBe('POST'); expect(path).toBe('checkout/guest/start');
      expect(forwarded.url).toBe('https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/start');
      expect(forwarded.headers.get('x-commerce-guest-capability')).toBe('synthetic-capability');
      expect(await forwarded.json()).toEqual({ lines: [] });
      return { success: true, data: { ok: true } };
    });
    const response = await operatorCheckout(request({ action: 'start', input: { lines: [] }, capability: 'synthetic-capability' }), { role: 50 }, dispatch);
    expect(response.status).toBe(200); expect(dispatch).toHaveBeenCalledOnce();
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('refuses unknown actions, arbitrary destinations, oversized requests and absent dispatch', async () => {
    const dispatch = vi.fn();
    for (const body of [{ action: 'catalog', input: {} }, { action: 'prepare', input: {}, url: 'https://other.invalid' }, { action: 'start', input: [] }]) {
      expect((await operatorCheckout(request(body), { role: 50 }, dispatch)).status).toBe(400);
    }
    expect((await operatorCheckout(request({ action: 'start', input: { text: 'x'.repeat(65536) } }), { role: 50 }, dispatch)).status).toBe(413);
    expect((await operatorCheckout(request(), { role: 50 })).status).toBe(503);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
