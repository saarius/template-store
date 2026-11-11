import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { receiptBrowserState, receiptRequestAllowed, receiptOrigin, receiptStatusPath, nativeReceiptStatusPath, retainedCheckoutKey } from "../../scripts/lib/backroadbum-retained-receipt.mjs";

describe("read-only retained receipt verification", () => {
  it.each(["GET", "HEAD"])("allows same-origin %s without new-checkout admission", method => {
    expect(receiptRequestAllowed(receiptOrigin + "/checkout/success", method)).toBe(true);
  });
  it("permits only the public status POST, with native diagnostics explicitly opted in", () => {
    expect(receiptRequestAllowed(receiptOrigin + receiptStatusPath, "POST")).toBe(true);
    expect(receiptRequestAllowed(receiptOrigin + nativeReceiptStatusPath, "POST")).toBe(false);
    expect(receiptRequestAllowed(receiptOrigin + nativeReceiptStatusPath, "POST", true)).toBe(true);
  });
  it.each([
    ["/api/checkout/start", "POST"],
    ["/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/prepare", "POST"],
    ["/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/start", "POST"],
    ["/_emdash/api/plugins/r_gshdrqaldna3r7sn/orders", "POST"],
    [receiptStatusPath, "PUT"], [receiptStatusPath, "DELETE"], [receiptStatusPath + "/", "POST"],
  ])("blocks unrelated or ambiguous request %s %s", (path, method) => {
    expect(receiptRequestAllowed(receiptOrigin + path, method, true)).toBe(false);
  });
  it.each(["https://payments.dinkuskit.com/", "https://checkout.stripe.com/", "https://backroadbum.com.attacker.invalid/", "http://backroadbum.com/", "https://user:password@backroadbum.com/", "not a URL"])("rejects external/credentialled requests: %s", url => {
    expect(receiptRequestAllowed(url, "GET", true)).toBe(false);
    expect(receiptRequestAllowed(url, "POST", true)).toBe(false);
  });
  it("drops merchant cookies and other origins without modifying the supplied state", () => {
    const retained = { name: retainedCheckoutKey, value: "synthetic-retention" };
    const origin = { origin: receiptOrigin, localStorage: [retained, { name: "unrelated-session", value: "fixture" }] };
    const state = { cookies: [{ name: "merchant-cookie", value: "fixture" }], origins: [
      { origin: "https://dinkuskit.com", localStorage: [] }, origin,
    ] };
    const before = structuredClone(state);
    expect(receiptBrowserState(state)).toEqual({ cookies: [], origins: [{ origin: receiptOrigin, localStorage: [retained] }] });
    expect(state).toEqual(before);
  });
  it.each([null, {}, { origins: [] }, { origins: [{ origin: receiptOrigin, localStorage: [] }] }])("refuses absent retained state with a generic error", state => {
    expect(() => receiptBrowserState(state)).toThrow("Retained receipt state unavailable");
  });
  it("keeps print verification independent of ready-checkout helpers and legacy receipt extras", () => {
    const source = readFileSync(new URL("../../scripts/verify-backroadbum-receipt-print.mjs", import.meta.url), "utf8");
    expect(source).toContain("openRetainedReceipt");
    expect(source).not.toContain("openShopperPreview");
    expect(source).not.toContain("api/checkout/health");
    expect(source).not.toContain("$22.00");
    expect(source).toContain("wire.checkout?.state, 'paid'");
    expect(source).toContain("stateDigest(), beforeFile");
    expect(source).toContain("if (order.test === true)");
  });
});
