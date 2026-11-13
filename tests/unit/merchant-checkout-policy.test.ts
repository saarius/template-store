import { afterEach, describe, expect, it, vi } from 'vitest';
import { merchantCheckoutClosed, merchantCheckoutPath, merchantCheckoutStatusPath, merchantOperator } from '../../src/features/guest-cart/merchant-policy.js';
import { acquireGuestCheckoutAdmission, canDispatchInstalledGuestCheckout, CHECKOUT_READINESS_SCHEMA } from '../../src/features/guest-cart/checkout-admission.js';
afterEach(() => vi.unstubAllEnvs());
describe('private merchant checkout rollout', () => {
  it('defaults closed for this profile, without changing generic stores', () => {
    expect(merchantCheckoutClosed({})).toBe(false);
    for (const value of [undefined, '', 'true', 'live', '0']) expect(merchantCheckoutClosed({ BACKROADBUM_MERCHANT_PROFILE: '1', BACKROADBUM_CHECKOUT_ENABLED: value })).toBe(true);
    expect(merchantCheckoutClosed({ BACKROADBUM_MERCHANT_PROFILE: '1', BACKROADBUM_CHECKOUT_ENABLED: '1' })).toBe(false);
  });
  it('only accepts EmDash administrator identity, never strings or browser assertions', () => {
    for (const user of [null, {}, { role: 'administrator' }, { role: '50' }, { role: 40 }, { admin: true }]) expect(merchantOperator(user)).toBe(false);
    expect(merchantOperator({ role: 50 })).toBe(true);
  });
  it('covers all checkout entry and recovery routes without blocking cart intent', () => {
    for (const action of ['prepare', 'start', 'status', 'cart', 'readiness']) expect(merchantCheckoutPath('/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/' + action)).toBe(true);
    expect(merchantCheckoutPath('/api/checkout/status')).toBe(true);
    for (const path of ['/cart', '/api/guest-cart/snapshot', '/shop']) expect(merchantCheckoutPath(path)).toBe(false);
  });
  it('exempts only the exact installed and storefront status paths from the new-checkout gate', () => {
    for (const path of ['/api/checkout/status', '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/status']) expect(merchantCheckoutStatusPath(path)).toBe(true);
    for (const path of ['/api/checkout/status/', '/api/checkout/status/prepare', '/foreign/status', '/_emdash/api/plugins/dinkus-commerce/checkout/guest/status',
      ...['prepare', 'start', 'cart', 'readiness'].map(action => '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/' + action)]) expect(merchantCheckoutStatusPath(path)).toBe(false);
  });
  it('admits the merchant build-time sandbox on API requests, not only anonymous pages', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
    vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '1');
    const runtime = {
      getRuntimePluginSettingsSchema: () => null,
      getPluginRouteMeta: (_id: string, path: string) => ({ public: true, methods: [path.endsWith('readiness') ? 'GET' : 'POST'] }),
      handlePublicPluginApiRoute: vi.fn(async () => ({ success: true, data: { schema: CHECKOUT_READINESS_SCHEMA, status: 'supported', mode: 'test' } })),
    };
    const request = new Request('https://backroadbum.com/cart');
    expect(await acquireGuestCheckoutAdmission({ runtime, request })).not.toBeNull();
    expect(canDispatchInstalledGuestCheckout({ runtime, request })).toBe(true);
    // No runtime manifest is still an error for ordinary installations.
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '0');
    expect(await acquireGuestCheckoutAdmission({ runtime, request })).toBeNull();
    expect(canDispatchInstalledGuestCheckout({ runtime, request })).toBe(false);
  });
  it('never substitutes the merchant flag for public POST metadata', () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
    const dispatch = async () => ({ success: true });
    for (const meta of [null, { public: false, methods: ['POST'] }, { public: true, methods: ['GET'] }]) {
      expect(canDispatchInstalledGuestCheckout({ runtime: { getRuntimePluginSettingsSchema: () => null, getPluginRouteMeta: () => meta, handlePublicPluginApiRoute: dispatch } })).toBe(false);
    }
    expect(canDispatchInstalledGuestCheckout({ runtime: { getRuntimePluginSettingsSchema: () => null, handlePublicPluginApiRoute: dispatch } })).toBe(false);
  });
  it('does not advertise checkout or spend readiness calls before the operator opens it', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
    vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '0');
    const dispatch = vi.fn();
    expect(await acquireGuestCheckoutAdmission({ runtime: { handlePublicPluginApiRoute: dispatch } })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
