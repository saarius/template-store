import { describe, expect, it } from 'vitest';
import { parseGuestCheckoutWireResult, GUEST_CHECKOUT_PROJECTION_SCHEMA } from '../../src/features/guest-cart/checkout-protocol.js';
import { confirmedOrderView } from '../../src/features/guest-cart/order-view.js';
const address = { name: 'Fixture Visitor', line1: '1 Test Way', city: 'Testville', region: 'NC', postalCode: '27601', country: 'US' };
function fixture() {
  return { ok: true, capabilityId: 'cart-fixture', checkout: {
    schema: GUEST_CHECKOUT_PROJECTION_SCHEMA, state: 'paid', attemptId: 'attempt-fixture', redirectUrl: null, retryAfter: null,
    order: { orderId: 'order:fixture', receiptId: 'receipt:fixture', test: true,
      lines: [{ catalogItemId: 'mug', name: 'Camp Mug', quantity: 2, unitPrice: { currency: 'USD', minor: '1600' } }],
      total: { currency: 'USD', minor: '3200' }, contact: { email: 'fixture@example.test', delivery: address, billing: address },
      status: 'completed', completed: { at: '2026-11-15T12:00:00.000Z', carrier: 'USPS', tracking: 'TEST-TRACKING' },
    },
  } };
}
describe('Field Journal beta cart receipt projection', () => {
  it('retains billing, native completion and frozen amounts through the merchant parser', () => {
    const result = parseGuestCheckoutWireResult(fixture()); expect(result?.ok).toBe(true); if (!result?.ok) return;
    const view = confirmedOrderView(result.checkout);
    expect(result.checkout.order?.contact?.billing).toEqual(address);
    expect(view?.billingAddress).toContain('1 Test Way');
    expect(view?.fulfillment).toEqual({ status: 'Completed', carrier: 'USPS', tracking: 'TEST-TRACKING' });
    expect(view?.totals).toContainEqual({ label: 'Total', amount: '$32.00' });
  });
  it('retains the previous wrapper completion shape without trusting malformed metadata', () => {
    const body = fixture();
    Object.assign(body.checkout.order, { fulfillment: { status: 'completed', completedAt: '2026-11-15T12:00:00.000Z', carrier: 'USPS' } });
    body.checkout.order.completed.at = 'invalid';
    const result = parseGuestCheckoutWireResult(body); if (!result?.ok) throw new Error('refused fixture');
    expect(result.checkout.order?.fulfillment?.status).toBe('completed');
  });
});
