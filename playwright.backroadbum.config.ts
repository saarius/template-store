import { defineConfig } from '@playwright/test';

// Public merchant UI with synthetic account responses and all unknown writes
// blocked. No credentials, live OTP, profile, purchase or fulfillment operation.
export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: ['backroadbum-account-contrast.spec.ts', 'backroadbum-product-details-navigation.spec.ts', 'backroadbum-collection-trail.spec.ts', 'backroadbum-variant-guidance.spec.ts', 'backroadbum-search-continuity.spec.ts', 'shopper-session-tabs.spec.ts', 'shopper-session-recovery.spec.ts', 'checkout-shopper-prefill.spec.ts', 'shopper-profile-feedback.spec.ts', 'backroadbum-checkout-keyboard.spec.ts', 'backroadbum-cart-retry.spec.ts'],
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'line',
  outputDir: 'test-results/backroadbum-account',
  use: {
    baseURL: process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com',
    userAgent: 'BackroadBum-SelfCheck/1.0',
    trace: 'off',
  },
  projects: [1440, 390].map(width => ({
    name: `backroadbum-${width}`,
    use: { viewport: { width, height: 1000 } },
  })),
});
