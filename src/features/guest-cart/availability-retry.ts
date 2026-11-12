import type { GuestCheckoutCallResult } from "./checkout-protocol.js";

/** This retries only an unstarted availability check, never a protected checkout. */
export function canRetryCheckoutAvailability(state: {
  serverAdmitted: boolean;
  failed: boolean;
  hasItems: boolean;
  recovering: boolean;
  hasRetention: boolean;
  canStart: boolean;
  canPrepareNew: boolean;
}): boolean {
  return state.serverAdmitted && state.failed && state.hasItems && !state.recovering &&
    !state.canStart && (!state.hasRetention || state.canPrepareNew);
}

export function checkoutAvailabilityFailure(response: GuestCheckoutCallResult): string {
  if (response.result && !response.result.ok && response.result.error.code === "CHECKOUT_LIMITED") {
    return "Checkout checks are limited right now. Your items are still in this cart. Wait a few minutes, then check again.";
  }
  return "We couldn’t check checkout availability. Your items are still in this cart. Try the check again.";
}
