import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
describe('merchant journey presentation boundaries', () => {
  it('keeps the receipt redesign screen-only and retains the native print contract', () => {
    const screen = read('src/features/guest-cart/receipt-screen.css');
    expect(screen).toContain('@media screen {');
    expect(screen).not.toContain('@media print');
    const page = read('src/pages/checkout/success.astro');
    expect(page).toContain('import "../../features/guest-cart/receipt-print.css"');
    expect(page).toContain('import "../../features/guest-cart/receipt-screen.css"');
    expect(page).toContain('data-receipt-page');
    const print = read('src/features/guest-cart/receipt-print.css');
    expect(print).toContain('@media print {');
    expect(print).toContain('body[data-receipt-page]');
    expect(print).toContain('.guest-checkout-item-thumb { display: none; }');
    // Native receipt states and browser-print guidance are rendered in
    // tests/presentation/native-journey.test.ts, not matched as legacy client markup.
  });
  it('sizes the native region and postal controls independently', () => {
    const checkout = read('src/features/guest-cart/GuestCheckout.astro');
    expect(checkout).toContain('width:min(100%,10rem)');
    expect(checkout).toContain('width:min(100%,14rem)');
    for (const kind of ['delivery', 'billing']) for (const field of ['region', 'postal-code']) {
      expect(checkout).toContain(`[data-guest-cart-${kind}-${field}]`);
    }
    // Attribute identities, autocomplete, countries and associated corrections
    // are checked against actual rendered controls by the presentation suite.
  });
});
