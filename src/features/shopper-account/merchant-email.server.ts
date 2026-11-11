// A configured sender is not delivery proof. The merchant enables the form only
// after verifying a real sign-in email through Commerce; checkout has its own gate.
export function isMerchantEmailSignInPaused(env: Record<string, string | undefined> = process.env): boolean {
  return env.BACKROADBUM_MERCHANT_PROFILE === "1" && env.BACKROADBUM_ACCOUNT_EMAIL_VERIFIED !== "1";
}
