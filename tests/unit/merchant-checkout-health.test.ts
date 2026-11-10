import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../src/pages/api/checkout/health.js';
import { CHECKOUT_READINESS_SCHEMA } from '../../src/features/guest-cart/checkout-admission.js';
afterEach(() => vi.unstubAllEnvs());
function context(dispatch = vi.fn(async () => ({ success: true, data: { schema: CHECKOUT_READINESS_SCHEMA, status: 'supported', mode: 'test' } }))) {
  return { request: new Request('https://backroadbum.com/api/checkout/health'), locals: { emdash: {
    handlePublicPluginApiRoute: dispatch, getRuntimePluginSettingsSchema: () => null,
    getPluginRouteMeta: (_id: string, path: string) => ({ public: true, methods: [path.endsWith('readiness') ? 'GET' : 'POST'] }),
  } } } as unknown as Parameters<typeof GET>[0];
}
describe('non-creating merchant health probe', () => {
  it('does not claim readiness while closed and does not prepare a capability', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1'); vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '0');
    const ctx = context(), response = await GET(ctx);
    expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ admission: 'closed', readiness: 'unavailable' });
  });
  it('only dispatches the GET readiness advisory and strictly reports test mode', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1'); vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '1');
    const dispatch = vi.fn(async () => ({ success: true, data: { schema: CHECKOUT_READINESS_SCHEMA, status: 'supported', mode: 'test' } }));
    const response = await GET(context(dispatch));
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ schema: 'backroadbum.checkout-health/v1', admission: 'open', readiness: 'supported', mode: 'test' });
    expect(dispatch).toHaveBeenCalledOnce(); expect(dispatch.mock.calls[0]?.slice(1, 3)).toEqual(['GET', 'checkout/guest/readiness']);
  });
  it('does not expose the merchant probe in generic stores', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '0'); expect((await GET(context())).status).toBe(404);
  });
});
