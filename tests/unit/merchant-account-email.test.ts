import { describe, expect, it } from "vitest";
import { isMerchantEmailSignInPaused } from "../../src/features/shopper-account/merchant-email.server.js";

describe("merchant email sign-in admission", () => {
  it("does not change the starter or playground default", () => {
    expect(isMerchantEmailSignInPaused({})).toBe(false);
    expect(isMerchantEmailSignInPaused({ BACKROADBUM_ACCOUNT_EMAIL_VERIFIED: "1" })).toBe(false);
  });

  it("pauses the merchant form until email delivery is explicitly verified", () => {
    for (const value of [undefined, "", "0", "true", "yes"]) {
      expect(isMerchantEmailSignInPaused({
        BACKROADBUM_MERCHANT_PROFILE: "1", BACKROADBUM_ACCOUNT_EMAIL_VERIFIED: value,
      })).toBe(true);
    }
    expect(isMerchantEmailSignInPaused({
      BACKROADBUM_MERCHANT_PROFILE: "1", BACKROADBUM_ACCOUNT_EMAIL_VERIFIED: "1",
    })).toBe(false);
  });

  it("keeps mail availability independent of checkout admission", () => {
    expect(isMerchantEmailSignInPaused({
      BACKROADBUM_MERCHANT_PROFILE: "1", BACKROADBUM_CHECKOUT_ENABLED: "1",
    })).toBe(true);
    expect(isMerchantEmailSignInPaused({
      BACKROADBUM_MERCHANT_PROFILE: "1", BACKROADBUM_CHECKOUT_ENABLED: "0",
      BACKROADBUM_ACCOUNT_EMAIL_VERIFIED: "1",
    })).toBe(false);
  });
});
