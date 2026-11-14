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
    const receipt = read('src/features/guest-cart/GuestCheckoutReturn.astro');
    expect(receipt).toContain('data-guest-checkout-print');
    expect(receipt).toContain('The page address alone cannot recover an order');
    expect(receipt).toContain('data-guest-checkout-pending-review');
  });
  it('sizes address codes independently without changing contact field identities or country choices', () => {
    const checkout = read('src/features/guest-cart/GuestCheckout.astro');
    expect(checkout).toContain('width:min(100%,10rem)');
    expect(checkout).toContain('width:min(100%,14rem)');
    for (const kind of ['delivery', 'billing']) for (const field of ['region', 'postal-code']) {
      expect(checkout).toContain(`data-guest-cart-${kind}-${field}`);
      expect(checkout).toContain(`autocomplete="${kind === 'delivery' ? 'shipping' : 'billing'} ${field === 'region' ? 'address-level1' : 'postal-code'}"`);
    }
    expect(checkout).toContain('data-guest-cart-contact-error="delivery-postal-code"');
    expect(checkout).toContain('<option value="US">United States</option>');
    expect(checkout).toContain('4242 4242 4242 4242');
  });
});
