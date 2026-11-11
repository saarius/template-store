import { formatUsdMinor } from "../store-shell/price.js";
import type { GuestCheckoutWireResult } from "./checkout-protocol.js";

/** The original Commerce amount, never today's cart or a claim of payment. */
export function pendingCheckoutAmount(result: GuestCheckoutWireResult): string | null {
  if (!result.ok || !result.checkout.attemptId || result.checkout.order ||
      !["pending", "recoverable-failure"].includes(result.checkout.state)) return null;
  const pricing = result.checkout.pricing;
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return null;
  const total = (pricing as Record<string, unknown>).finalTotal;
  if (!total || typeof total !== "object" || Array.isArray(total)) return null;
  const { currency, minor } = total as Record<string, unknown>;
  if (currency !== "USD" || typeof minor !== "string" || !/^(0|[1-9][0-9]{0,15})$/u.test(minor)) return null;
  return formatUsdMinor(minor);
}
