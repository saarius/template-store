import { describe, expect, it } from 'vitest';
import { admitMerchantServerCart } from '../../src/features/guest-cart/merchant-admission.js';
import { merchantServerCartMutationPath } from '../../src/features/guest-cart/merchant-policy.js';

const origin = 'https://backroadbum.com';
function request(path = '/cart/add', headers: Record<string, string> = {}, body = 'id=mug&quantity=1') {
  return new Request(origin + path, { method: 'POST', headers: {
    origin, 'content-type': 'application/x-www-form-urlencoded', 'x-backroadbum-client-ip': '203.0.113.1', ...headers,
  }, body });
}
const allowed = () => ({ allowed: true, retryAfter: 0 });
describe('merchant server-cart outer admission', () => {
  it('classifies plain and enhanced mutations, not reads or unrelated addresses', () => {
    for (const path of ['/checkout', '/cart/add', '/cart/change', '/cart/update', '/cart/add.js', '/cart/change.js', '/cart/update.js']) expect(merchantServerCartMutationPath(path)).toBe(true);
    for (const path of ['/cart', '/cart.js', '/checkout/success', '/cart/additional', '/cart/add/']) expect(merchantServerCartMutationPath(path)).toBe(false);
  });
  it('admits native form, browser FormData and JSON enhanced requests', async () => {
    expect(await admitMerchantServerCart(request(), '/cart/add', allowed)).toBeNull();
    const form = new FormData(); form.set('id', 'mug'); form.set('quantity', '1');
    expect(await admitMerchantServerCart(new Request(origin + '/cart/add.js', { method: 'POST', headers: { origin, 'x-backroadbum-client-ip': '203.0.113.1' }, body: form }), '/cart/add.js', allowed)).toBeNull();
    expect(await admitMerchantServerCart(request('/cart/update.js', { 'content-type': 'application/json' }, '{"lines":[]}'), '/cart/update.js', allowed)).toBeNull();
  });
  it('refuses foreign origin, untrusted peer, wrong types and oversized bodies before dispatch', async () => {
    expect((await admitMerchantServerCart(request('/checkout', { origin: 'https://foreign.example' }), '/checkout', allowed))?.status).toBe(403);
    expect((await admitMerchantServerCart(request('/checkout', { 'x-backroadbum-client-ip': '' }), '/checkout', allowed))?.status).toBe(503);
    expect((await admitMerchantServerCart(request('/checkout', { 'content-type': 'application/json' }), '/checkout', allowed))?.status).toBe(415);
    expect((await admitMerchantServerCart(request('/checkout', {}, 'x'.repeat(100_000)), '/checkout', allowed))?.status).toBe(413);
  });
  it('uses persistent start/prepare budgets and fails closed on limiter errors', async () => {
    const actions: string[] = [];
    const take = (action: string) => { actions.push(action); return { allowed: false, retryAfter: 60 }; };
    const response = await admitMerchantServerCart(request('/checkout'), '/checkout', take);
    expect(response?.status).toBe(429); expect(response?.headers.get('Retry-After')).toBe('60');
    await admitMerchantServerCart(request(), '/cart/add', take); expect(actions).toEqual(['start', 'prepare']);
    expect((await admitMerchantServerCart(request(), '/cart/add', () => { throw new Error('unavailable'); }))?.status).toBe(503);
  });
});
