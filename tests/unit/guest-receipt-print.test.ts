import { afterEach, describe, expect, it, vi } from "vitest";
import { hydrateGuestCheckoutReturn } from "../../src/features/guest-cart/guest-cart-client.js";
import { GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY } from "../../src/features/guest-cart/index.js";

class Element {
  hidden = true;
  textContent = "";
  listeners = new Map<string, () => void>();
  children = new Map<string, Element>();
  querySelector(selector: string) { return this.children.get(selector) ?? null; }
  addEventListener(event: string, listener: () => void) { this.listeners.set(event, listener); }
  setAttribute() {}
}
class Button extends Element { disabled = false; }
class Anchor extends Element {}
function setup(saved: string | null, response: unknown) {
  const values = new Map<string, string>();
  if (saved !== null) values.set(GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY, saved);
  const root = new Element();
  const order = new Element();
  const print = new Button();
  const status = new Element();
  root.children.set("[data-guest-checkout-order]", order);
  root.children.set("[data-guest-checkout-print]", print);
  root.children.set("[data-guest-checkout-return-status]", status);
  const review = new Element(), amount = new Element(), title = new Element(), statusRetry = new Button();
  root.children.set("[data-guest-checkout-pending-review]", review);
  root.children.set("[data-guest-checkout-pending-amount]", amount);
  root.children.set("#guest-checkout-return-title", title);
  root.children.set("[data-guest-checkout-status-retry]", statusRetry);
  vi.stubGlobal("HTMLElement", Element);
  vi.stubGlobal("HTMLButtonElement", Button);
  vi.stubGlobal("HTMLAnchorElement", Anchor);
  vi.stubGlobal("document", { querySelector: (selector: string) => selector === "[data-guest-checkout-return]" ? root : null, querySelectorAll: () => [] });
  vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const printCall = vi.fn();
  const fetchCall = vi.fn(async () => Response.json(response));
  vi.stubGlobal("window", { print: printCall });
  vi.stubGlobal("fetch", fetchCall);
  return { order, print, printCall, fetchCall, values, review, amount, title, statusRetry };
}
const retention = JSON.stringify({ capabilityId: "cap-1", capability: "cap-1.secret", attemptId: "attempt-1" });
function wire(state: string, overrides = {}) {
  return { ok: true, capabilityId: "cap-1", checkout: {
    schema: "dinkuskit.commerce.guest-checkout-projection/v1", state, attemptId: "attempt-1", redirectUrl: null,
    order: state === "paid" ? { orderId: "order:1", receiptId: "receipt:1", test: true, lines: [{ catalogItemId: "mug", quantity: 1, imageUrl: "/merch/mug.svg" }], total: { currency: "USD", minor: "2200" } } : null,
    retryAfter: null, ...overrides,
  } };
}
afterEach(() => vi.unstubAllGlobals());
describe("receipt printing", () => {
  it("keeps a pending amount separate from a later paid receipt", async () => {
    const pending = wire("pending", { pricing: { finalTotal: { currency: "USD", minor: "7900" } } });
    const fixture = setup(retention, pending);
    fixture.fetchCall.mockResolvedValueOnce(Response.json(pending)).mockResolvedValueOnce(Response.json(wire("paid")));
    hydrateGuestCheckoutReturn();
    await vi.waitFor(() => expect(fixture.review.hidden).toBe(false));
    expect(fixture.amount.textContent).toBe("$79.00");
    expect(fixture.title.textContent).toBe("Checkout status");
    expect(fixture.order.hidden).toBe(true);
    expect(fixture.print.hidden).toBe(true);
    fixture.statusRetry.listeners.get("click")!();
    await vi.waitFor(() => expect(fixture.order.hidden).toBe(false));
    expect(fixture.review.hidden).toBe(true);
    expect(fixture.title.textContent).toBe("Order confirmation");
    expect(fixture.print.hidden).toBe(false);
  });
  it("hides an earlier pending amount when a later status check fails", async () => {
    const pending = wire("pending", { pricing: { finalTotal: { currency: "USD", minor: "7900" } } });
    const fixture = setup(retention, pending);
    fixture.fetchCall.mockResolvedValueOnce(Response.json(pending)).mockResolvedValueOnce(Response.json({ ok: false, error: { code: "UNAVAILABLE", message: "Unavailable" } }));
    hydrateGuestCheckoutReturn();
    await vi.waitFor(() => expect(fixture.review.hidden).toBe(false));
    fixture.statusRetry.listeners.get("click")!();
    await vi.waitFor(() => expect(fixture.title.textContent).toBe("We couldn't confirm your order"));
    expect(fixture.review.hidden).toBe(true);
    expect(fixture.print.hidden).toBe(true);
  });
  it("prints only the confirmed view, without further network or storage changes, including a second click after cancellation", async () => {
    const fixture = setup(retention, wire("paid"));
    hydrateGuestCheckoutReturn();
    expect(fixture.print.hidden).toBe(true);
    fixture.print.listeners.get("click")!();
    expect(fixture.printCall).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fixture.print.hidden).toBe(false));
    await vi.waitFor(() => expect(fixture.fetchCall).toHaveBeenCalledTimes(1));
    const saved = [...fixture.values];
    fixture.print.listeners.get("click")!();
    fixture.print.listeners.get("click")!();
    expect(fixture.printCall).toHaveBeenCalledTimes(2);
    expect(fixture.fetchCall).toHaveBeenCalledTimes(1);
    expect([...fixture.values]).toEqual(saved);
  });
  it.each([
    ["empty", null, wire("paid")],
    ["corrupt", "{bad", wire("paid")],
    ["pending", retention, wire("pending")],
    ["refused", retention, { ok: false, error: { code: "UNAVAILABLE", message: "Unavailable" } }],
    ["unconfirmed paid", retention, wire("paid", { order: null })],
    ["wrong association", retention, { ...wire("paid"), capabilityId: "someone-else" }],
  ])("does not offer or invoke receipt printing for %s", async (_name, saved, response) => {
    const fixture = setup(saved as string | null, response);
    hydrateGuestCheckoutReturn();
    await new Promise(resolve => setTimeout(resolve, 10));
    expect(fixture.print.hidden).toBe(true);
    expect(fixture.order.hidden).toBe(true);
    fixture.print.listeners.get("click")!();
    expect(fixture.printCall).not.toHaveBeenCalled();
  });
});
