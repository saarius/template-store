import { describe, expect, it } from "vitest";
import { pendingCheckoutAmount } from "../../src/features/guest-cart/pending-review.js";
import type { GuestCheckoutWireResult } from "../../src/features/guest-cart/checkout-protocol.js";

const wire = (overrides: Record<string, unknown> = {}): GuestCheckoutWireResult => ({
  ok: true, capabilityId: "cap-1", checkout: {
    schema: "dinkuskit.commerce.guest-checkout-projection/v1", state: "pending",
    attemptId: "attempt-1", redirectUrl: null, order: null, retryAfter: null,
    pricing: { finalTotal: { currency: "USD", minor: "7900" } }, ...overrides,
  },
} as GuestCheckoutWireResult);

describe("pending checkout amount", () => {
  it("uses only the original Commerce pricing, even without a payable redirect", () => {
    expect(pendingCheckoutAmount(wire({ total: { currency: "USD", minor: "7200" } }))).toBe("$79.00");
  });
  it("supports a recoverable protected attempt without calling it paid", () => {
    expect(pendingCheckoutAmount(wire({ state: "recoverable-failure" }))).toBe("$79.00");
  });
  it("supports an authoritative zero amount", () => {
    expect(pendingCheckoutAmount(wire({ pricing: { finalTotal: { currency: "USD", minor: "0" } } }))).toBe("$0.00");
  });
  it.each([
    ["paid", { state: "paid" }],
    ["released", { state: "released-retry" }],
    ["prepared only", { attemptId: null }],
    ["order present", { order: { orderId: "order-1" } }],
    ["older projection", { pricing: undefined, total: { currency: "USD", minor: "7900" } }],
    ["missing total", { pricing: {} }],
    ["array pricing", { pricing: [] }],
    ["array total", { pricing: { finalTotal: [] } }],
    ["currency mismatch", { pricing: { finalTotal: { currency: "EUR", minor: "7900" } } }],
    ["fractional", { pricing: { finalTotal: { currency: "USD", minor: "79.00" } } }],
    ["negative", { pricing: { finalTotal: { currency: "USD", minor: "-1" } } }],
    ["unbounded", { pricing: { finalTotal: { currency: "USD", minor: "9".repeat(1000) } } }],
  ])("omits the review for %s", (_name, overrides) => {
    expect(pendingCheckoutAmount(wire(overrides))).toBeNull();
  });
  it("omits refused responses", () => {
    expect(pendingCheckoutAmount({ ok: false, error: { code: "UNAVAILABLE", message: "Unavailable" } })).toBeNull();
  });
});
