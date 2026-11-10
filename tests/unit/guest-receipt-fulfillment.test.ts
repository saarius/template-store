import { describe, expect, it } from "vitest";
import { confirmedOrderHeading } from "../../src/features/guest-cart/guest-cart-client.js";
import { guestCheckoutWire, parseGuestCheckoutWireResult, parseGuestOrderFulfillment } from "../../src/features/guest-cart/checkout-protocol.js";
const completed = { status: "completed", completedAt: "2026-11-10T01:00:00.000Z", carrier: "Demo carrier", tracking: "TEST-NOT-A-SHIPMENT" };
function wire(fulfillment: unknown) {
  return { ok: true, capabilityId: "fixture-capability", checkout: {
    schema: "dinkuskit.commerce.guest-checkout-projection/v1", state: "paid", attemptId: "fixture-attempt", redirectUrl: null,
    order: { orderId: "order:fixture", receiptId: "receipt:fixture", test: true, fulfillment,
      lines: [{ catalogItemId: "mug", quantity: 1 }], total: { currency: "USD", minor: "2200" } }, retryAfter: null,
  } };
}
describe("canonical receipt number", () => {
  it("keeps the Orders number through parsing, relay and display without deriving it from an ID", () => {
    const value = wire(completed);
    const parsed = parseGuestCheckoutWireResult({ ...value, checkout: { ...value.checkout, order: { ...value.checkout.order, number: 1004 } } });
    if (!parsed?.ok) throw Error("fixture must parse");
    expect(parsed.checkout.order?.number).toBe(1004);
    const relayed = parseGuestCheckoutWireResult({ ...parsed, checkout: guestCheckoutWire(parsed.checkout) });
    if (!relayed?.ok || !relayed.checkout.order) throw Error("relay must parse");
    expect(confirmedOrderHeading(relayed.checkout.order)).toBe("Order #1004");
    expect(relayed.checkout.order.orderId).toBe("order:fixture");
  });
  it.each([undefined, null, "1004", 0, -1, 1004.5, Number.MAX_SAFE_INTEGER + 1])("omits invalid optional number %j and keeps the canonical ID fallback", number => {
    const value = wire(completed);
    const parsed = parseGuestCheckoutWireResult({ ...value, checkout: { ...value.checkout, order: { ...value.checkout.order, number } } });
    if (!parsed?.ok || !parsed.checkout.order) throw Error("paid receipt remains valid");
    expect(parsed.checkout.order.number).toBeUndefined();
    expect(confirmedOrderHeading(parsed.checkout.order)).toBe("Order fixture");
  });
});

describe("guest receipt fulfillment", () => {
  it("preserves current completion through the server status relay and browser parser", () => {
    const parsed = parseGuestCheckoutWireResult(wire(completed));
    expect(parsed?.ok).toBe(true);
    if (!parsed?.ok) throw Error("fixture must parse");
    expect(parsed.checkout.order?.fulfillment).toEqual(completed);
    const relayed = parseGuestCheckoutWireResult({ ...parsed, checkout: guestCheckoutWire(parsed.checkout) });
    expect(relayed?.ok && relayed.checkout.order?.fulfillment).toEqual(completed);
    expect(relayed?.ok && relayed.checkout.order?.test).toBe(true);
  });
  it("clears stale completed fields for Processing", () => {
    expect(parseGuestOrderFulfillment({ ...completed, status: "processing" })).toEqual({ status: "processing" });
  });
  it.each([undefined, null, [], {}, { status: "delivered" }, { ...completed, completedAt: "bad date" }])(
    "does not invent a state from malformed optional data (%j)", value => {
      expect(parseGuestOrderFulfillment(value)).toBeUndefined();
      const parsed = parseGuestCheckoutWireResult(wire(value));
      expect(parsed?.ok && parsed.checkout.order?.fulfillment).toBeUndefined();
    },
  );
  it("keeps text as text, excludes private fields and rejects oversized or control-bearing notes", () => {
    expect(parseGuestOrderFulfillment({ ...completed, carrier: '<b>not HTML</b>', email: 'private@example.test' })).toEqual({ ...completed, carrier: '<b>not HTML</b>' });
    expect(parseGuestOrderFulfillment({ ...completed, carrier: 'x'.repeat(65), tracking: 'bad\ntracking' })).toEqual({ status: 'completed', completedAt: completed.completedAt });
  });
});
