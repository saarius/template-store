import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/features/guest-cart/cart-script.js", () => ({ hydrateServerCartForms: vi.fn() }));
vi.mock("../../src/features/guest-cart/shopper-prefill.js", () => ({ prefillShopperContact: vi.fn() }));
import { hydrateServerCheckout } from "../../src/features/guest-cart/checkout-script.js";

// Native navigation owns the first POST. The optional enhancement only refuses
// another submit on the same document; no inline-lines/client start may return.
describe("merchant server checkout submission", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fixture() {
    const listeners = new Map<string, (event: any) => void>();
    const windowListeners = new Map<string, (event: any) => void>();
    const button = { textContent: "Continue to secure checkout" };
    const form = {
      dataset: {} as Record<string, string>,
      querySelector: () => button,
      addEventListener: (name: string, listener: (event: any) => void) => listeners.set(name, listener),
    };
    const root = { querySelector: (selector: string) => selector === "[data-checkout-form]" ? form : null };
    const reload = vi.fn();
    vi.stubGlobal("document", { querySelector: () => root });
    vi.stubGlobal("window", { location: { reload }, addEventListener: (name: string, listener: (event: any) => void) => windowListeners.set(name, listener) });
    vi.stubGlobal("HTMLElement", class {});
    vi.stubGlobal("HTMLInputElement", class {});
    hydrateServerCheckout();
    const submit = () => {
      const preventDefault = vi.fn();
      listeners.get("submit")!({ currentTarget: form, preventDefault });
      return preventDefault;
    };
    return { form, button, submit, windowListeners, reload };
  }

  it("lets the first native submit navigate and refuses a second Enter or click", () => {
    const f = fixture();
    expect(f.submit()).not.toHaveBeenCalled();
    expect(f.form.dataset.submitting).toBe("true");
    expect(f.button.textContent).toBe("Opening secure checkout…");
    expect(f.submit()).toHaveBeenCalledOnce();
    expect(f.submit()).toHaveBeenCalledOnce();
  });

  it("refreshes restored checkout authority, not an ordinary initial page load", () => {
    const f = fixture();
    f.windowListeners.get("pageshow")!({ persisted: false });
    expect(f.reload).not.toHaveBeenCalled();
    f.windowListeners.get("pageshow")!({ persisted: true });
    expect(f.reload).toHaveBeenCalledOnce();
  });

  it("keeps exactly one real POST form with named contact inputs and no legacy client form", () => {
    const source = readFileSync(new URL("../../src/features/guest-cart/GuestCheckout.astro", import.meta.url), "utf8");
    expect(source.match(/<form\b/gu)).toHaveLength(1);
    expect(source).toContain('method="post" action="/checkout"');
    expect(source).toContain('data-checkout-form novalidate');
    expect(source).toContain('name="email"');
    expect(source).toContain('name={`delivery[${field}]`}');
    expect(source).toContain('name={`billing[${field}]`}');
    expect(source).toContain('type="submit" data-guest-cart-checkout');
    expect(source).not.toContain("data-guest-cart-checkout-form");
    expect(source).not.toContain("data-checkout-no-script");
    const entry = readFileSync(new URL("../../src/pages/checkout/index.astro", import.meta.url), "utf8");
    expect(entry).toContain("sameStoreRequest(cartContext)");
    expect(entry).toContain("readBoundedForm(Astro.request, 16 * 1024)");
    expect(entry).toContain("readContactForm(form, page.view.needsDelivery)");
    expect(entry).toContain("Astro.response.status = 422");
  });
});
