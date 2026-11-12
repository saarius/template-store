import { expect, it } from "vitest";
import { canRetryCheckoutAvailability, checkoutAvailabilityFailure } from "../../src/features/guest-cart/availability-retry.js";

const eligible = { serverAdmitted: true, failed: true, hasItems: true, recovering: false, hasRetention: false, canStart: false, canPrepareNew: false };
it("offers only an explicit retry of a refused unstarted availability check", () => {
  expect(canRetryCheckoutAvailability(eligible)).toBe(true);
  for (const change of [
    { serverAdmitted: false }, { failed: false }, { hasItems: false }, { recovering: true },
    { hasRetention: true }, { canStart: true },
  ]) expect(canRetryCheckoutAvailability({ ...eligible, ...change })).toBe(false);
  expect(canRetryCheckoutAvailability({ ...eligible, hasRetention: true, canPrepareNew: true })).toBe(true);
  expect(canRetryCheckoutAvailability({ ...eligible, hasRetention: true, recovering: true, canPrepareNew: true })).toBe(false);
});
it("distinguishes the merchant limit from an unavailable check without claiming a payment outcome", () => {
  expect(checkoutAvailabilityFailure({ result: { ok: false, error: { code: "CHECKOUT_LIMITED", message: "ignored" } }, failure: null }))
    .toBe("Checkout checks are limited right now. Your items are still in this cart. Wait a few minutes, then check again.");
  for (const failure of ["network", "timeout", "wrong-shape", "storage-unavailable"] as const) {
    expect(checkoutAvailabilityFailure({ result: null, failure })).toContain("couldn’t check checkout availability");
  }
  expect(checkoutAvailabilityFailure({ result: { ok: false, error: { code: "OTHER", message: "private diagnostic" } }, failure: null }))
    .not.toContain("private diagnostic");
});
