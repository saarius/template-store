import { afterEach, describe, expect, it, vi } from 'vitest';
import type { APIContext, MiddlewareHandler } from 'astro';

vi.mock('astro:middleware', () => ({ defineMiddleware: (handler: MiddlewareHandler) => handler }));
vi.mock('../../src/features/playground/demo-products.js', () => ({ isDemoCatalogProfile: () => false }));
const { take } = vi.hoisted(() => ({ take: vi.fn(() => ({ allowed: true, retryAfter: 100 })) }));
vi.mock('../../src/features/guest-cart/merchant-limits.server.js', () => ({ merchantLimits: () => ({ take }) }));

import { onRequest } from '../../src/middleware.js';
import { POST } from '../../src/pages/api/checkout/status.js';

const origin = 'https://backroadbum.com';
const base = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/';
const paid = { schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'paid', attemptId: 'attempt-1',
  redirectUrl: null, retryAfter: null, order: { orderId: 'order-1', receiptId: 'receipt-1',
    lines: [{ catalogItemId: 'mug', quantity: 1 }], total: { currency: 'USD', minor: '2200' } } };

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
async function invoke(path: string, headers: Record<string, string> = {}, body = '{}', method = 'POST', enabled = '0') {
  vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
  vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', enabled);
  vi.stubEnv('EMDASH_SITE_URL', origin);
  vi.stubEnv('DINKUS_HOSTING_PROFILE', 'node');
  vi.stubEnv('DINKUS_STOREFRONT_PROFILE', 'shipping');
  const dispatch = vi.fn(async (_id: string, _method: string, _path: string, req: Request) => ({ success: true,
    data: req.headers.get('x-commerce-guest-capability') === 'cap.synthetic'
      ? { ok: true, capabilityId: 'cap', checkout: paid }
      : { ok: false, error: { code: 'CAPABILITY_DENIED', message: 'Denied' } } }));
  const request = new Request(origin + path, { method, headers: { origin, 'content-type': 'application/json',
    'x-backroadbum-client-ip': '192.0.2.1', 'x-commerce-guest-capability': 'cap.synthetic', ...headers },
    ...(method === 'POST' ? { body } : {}) });
  const context = { request, url: new URL(request.url), cookies: { get: () => undefined }, locals: { emdash: {
    getRuntimePluginSettingsSchema: () => null,
    getPluginRouteMeta: () => ({ public: true, methods: ['POST'] }), handlePublicPluginApiRoute: dispatch,
  } } } as unknown as APIContext;
  const next = vi.fn(async () => path === '/api/checkout/status' ? POST(context) : Response.json({ native: true }));
  const response = await onRequest(context, next);
  return { response: response!, next, dispatch };
}

describe('receipt recovery during a merchant checkout pause', () => {
  it('passes the existing capability to Commerce without readiness or checkout creation', async () => {
    const { response, dispatch } = await invoke('/api/checkout/status');
    expect(response.status).toBe(200);
    expect((await response.json()).checkout.order.orderId).toBe('order-1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(take).toHaveBeenCalledWith('status', '192.0.2.1');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]?.slice(0, 3)).toEqual(['r_gshdrqaldna3r7sn', 'POST', 'checkout/guest/status']);
  });
  it('keeps the same recovery rate budget during a pause in explicit cart-read mode', async () => {
    vi.stubEnv('BACKROADBUM_RECOVERY_PROTOCOL', 'cart-v1');
    const { response, dispatch } = await invoke('/api/checkout/status', {}, '{"attemptId":"attempt-1"}');
    expect(response.status).toBe(200);
    expect((await response.json()).checkout.order.orderId).toBe('order-1');
    expect(take).toHaveBeenCalledWith('status', '192.0.2.1');
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]?.slice(0, 3)).toEqual(['r_gshdrqaldna3r7sn', 'POST', 'checkout/guest/cart']);
    expect(await dispatch.mock.calls[0]?.[3].text()).toBe('{}');
  });
  it('does not expose the mutable native cart endpoint when legacy checkout is open', async () => {
    const { response, dispatch, next } = await invoke(base + 'cart', {}, '{"lines":[],"version":null}', 'POST', '1');
    expect(response.status).toBe(403);
    expect(dispatch).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled(); expect(take).not.toHaveBeenCalled();
  });
  it('also retains admission controls on the native status route', async () => {
    const { response, next } = await invoke(base + 'status');
    expect(response.status).toBe(200); expect(next).toHaveBeenCalledOnce();
    expect(take).toHaveBeenCalledWith('status', '192.0.2.1');
  });
  it.each(['prepare', 'start', 'cart', 'readiness', '%70repare', '%73tart'])('still blocks %s before any body, counter or runtime work', async action => {
    const { response, next, dispatch } = await invoke(base + action);
    expect(response.status).toBe(503); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(next).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled(); expect(take).not.toHaveBeenCalled();
  });
  it.each([
    [{ origin: 'https://foreign.test' }, '{}', 'POST', 403],
    [{ 'sec-fetch-site': 'cross-site' }, '{}', 'POST', 403],
    [{ 'content-type': 'text/plain' }, '{}', 'POST', 415],
    [{}, '{"amount":1}', 'POST', 400],
    [{}, 'x'.repeat(4097), 'POST', 413],
    [{}, '{}', 'GET', 405],
  ] as const)('retains request admission: %j', async (headers, body, method, code) => {
    const { response, dispatch, next } = await invoke('/api/checkout/status', headers, body, method);
    expect(response.status).toBe(code); expect(dispatch).not.toHaveBeenCalled(); expect(next).not.toHaveBeenCalled();
    expect(take).not.toHaveBeenCalled();
  });
  it('retains Commerce capability denial instead of returning a saved receipt', async () => {
    const { response, dispatch } = await invoke('/api/checkout/status', { 'x-commerce-guest-capability': 'cap.invalid' });
    expect(response.status).toBe(503); expect((await response.json()).error.code).toBe('CHECKOUT_STATUS_CAPABILITY_DENIED');
    expect(dispatch).toHaveBeenCalledOnce();
  });
  it('retains the separate status budget before dispatch', async () => {
    take.mockReturnValueOnce({ allowed: false, retryAfter: 100 });
    const { response, dispatch, next } = await invoke('/api/checkout/status');
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('100');
    expect(next).not.toHaveBeenCalled(); expect(dispatch).not.toHaveBeenCalled();
  });
});
