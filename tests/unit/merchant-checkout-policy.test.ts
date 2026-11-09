import { afterEach, describe, expect, it, vi } from 'vitest';
import { merchantCheckoutClosed, merchantCheckoutPath, merchantOperator } from '../../src/features/guest-cart/merchant-policy.js';
import { acquireGuestCheckoutAdmission } from '../../src/features/guest-cart/checkout-admission.js';
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
    for (const action of ['prepare', 'start', 'status', 'readiness']) expect(merchantCheckoutPath('/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/' + action)).toBe(true);
    expect(merchantCheckoutPath('/api/checkout/status')).toBe(true);
    for (const path of ['/cart', '/api/guest-cart/snapshot', '/shop']) expect(merchantCheckoutPath(path)).toBe(false);
  });
  it('does not advertise checkout or spend readiness calls before the operator opens it', async () => {
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
    vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '0');
    const dispatch = vi.fn();
    expect(await acquireGuestCheckoutAdmission({ runtime: { handlePublicPluginApiRoute: dispatch } })).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
