import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import Checkout from '../../src/features/guest-cart/GuestCheckout.astro';
import Cart from '../../src/features/guest-cart/GuestCart.astro';
import Receipt from '../../src/features/guest-cart/GuestCheckoutReturn.astro';
import AddToCart from '../../src/features/guest-cart/AddToCart.astro';
import type { PublicCommerceProduct, PublicCommerceVariant } from '../../src/features/commerce-catalog/types';
import { presentGuestCart } from '../../src/features/guest-cart/present';
import type { CheckoutReturn } from '../../src/features/guest-cart/server-return';
import type { ConfirmedOrderView } from '../../src/features/guest-cart/order-view';

vi.mock('../../src/features/guest-cart/server-view.js', () => ({
  loadServerCartPage: () => { throw new Error('Presentation cases must supply a server-read cart.'); },
}));

const view = presentGuestCart({
  intent: { version: 1, lines: [{ id: 'synthetic-notebook', quantity: 1 }] },
  snapshots: [{ id: 'synthetic-notebook', found: true, name: 'Synthetic notebook', sku: 'SYNTHETIC-BOOK', fulfillment: 'physical', price: { listable: true, regularText: '$12.00', saleText: null, unitMinor: '1200' }, availability: { status: 'in-stock', sellable: true, listable: true } }],
  snapshotFailed: false, checkoutAdmitted: true,
});
const page = { view, result: { ok: false, error: { code: 'NO_CART', message: 'Synthetic fixture' } }, snapshots: null, notice: null, error: null, paymentHeld: false, openPayment: null };
const order: ConfirmedOrderView = {
  orderNumber: '#7001', test: true,
  lines: [{ id: 'synthetic-notebook', sku: 'SYNTHETIC-BOOK', text: 'Synthetic notebook × 1', variant: null, amount: '$12.00', thumbnail: null }],
  totals: [{ label: 'Total', amount: '$12.00' }],
  email: 'synthetic@example.test', recipient: 'Synthetic Shopper', address: '12 Example Way', billingAddress: null, shippingMethod: 'Free shipping',
  fulfillment: { status: 'Completed', carrier: 'USPS', tracking: 'SYNTHETIC-TRACKING' },
};

type Element = { name: string; attributes: Record<string, string> };
// sax is already a direct dependency. Its HTML mode decodes quoted attributes
// and handles void controls; a tag regexp would truncate a valid value at ">".
const { parser } = createRequire(import.meta.url)('sax') as {
  parser(strict: boolean, options: { lowercase: boolean }): {
    onopentag: (element: Element) => void;
    write(html: string): { close(): void };
  };
};
function elements(html: string): Element[] {
  const result: Element[] = [], document = parser(false, { lowercase: true });
  document.onopentag = element => result.push(element);
  document.write(`<fragment>${html}</fragment>`).close();
  return result;
}
function tag(html: string, element: string, attribute: string, value: string): Record<string, string> {
  const found = elements(html).find(node => node.name === element && node.attributes[attribute] === value);
  expect(found, `${element}[${attribute}="${value}"]`).toBeDefined();
  return found!.attributes;
}
async function renderCheckout(props = {}) {
  const container = await AstroContainer.create();
  return container.renderToString(Checkout, { props: { page, checkoutAdmission: {}, ...props } });
}
async function renderReceipt(result: CheckoutReturn) {
  const container = await AstroContainer.create();
  return container.renderToString(Receipt, { props: { result } });
}

describe('native merchant journey rendering', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Presentation tests must not make network requests.'); })); });
  afterEach(() => {
    try { expect(fetch).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
  it.each(['in-stock', 'available-on-backorder', 'out-of-stock'] as const)('renders the selected %s member honestly before hydration', async status => {
    const sellable = status !== 'out-of-stock';
    const product: PublicCommerceProduct = {
      id: 'synthetic-xl', name: 'Synthetic tee', sku: 'SYNTHETIC-XL', image: null, gallery: [],
      price: { listable: true, regularText: '$34.00', saleText: null, unitMinor: '3400' },
      availability: { status, sellable, listable: true },
    };
    const variants: PublicCommerceVariant[] = [
      { id: 'synthetic-l', selections: [['Size', 'L']], unitMinor: '3400', priceText: '$34.00', availability: { status: 'in-stock', sellable: true } },
      { id: product.id, selections: [['Size', 'XL']], unitMinor: '3400', priceText: '$34.00', availability: { status, sellable } },
    ];
    const container = await AstroContainer.create();
    const html = await container.renderToString(AddToCart, { props: { product, variants, productId: 'synthetic-root', formId: 'synthetic-add' } });
    const button = tag(html, 'button', 'data-add-to-cart', product.id);
    expect(Object.hasOwn(button, 'disabled')).toBe(!sellable);
    expect(button['data-add-to-cart-sellable']).toBe(String(sellable));
    expect(html).toContain(sellable ? 'Add to cart' : 'Sold out');
    expect(tag(html, 'form', 'id', 'synthetic-add')).toMatchObject({ method: 'post', action: '/cart/add' });
    expect(tag(html, 'input', 'name', 'productId').value).toBe('synthetic-root');
    expect(tag(html, 'input', 'name', 'quantity').value).toBe('1');
    expect(elements(html).some(node => node.attributes.name === 'id')).toBe(false);
  });

  it.each([true, false])('renders a native cart product destination only when a published path exists (%s)', async linked => {
    const cartView = { ...view, lines: view.lines.map(line => ({ ...line, productPath: linked ? '/products/field-book?item=synthetic-notebook' : null })) };
    const container = await AstroContainer.create();
    const html = await container.renderToString(Cart, { props: { page: { ...page, view: cartView }, checkoutAdmission: {} } });
    const links = elements(html).filter(node => Object.hasOwn(node.attributes, 'data-guest-cart-product-link'));
    expect(links).toHaveLength(linked ? 1 : 0);
    if (linked) expect(links[0].attributes.href).toBe('/products/field-book?item=synthetic-notebook');
    else expect(html).toMatch(/<h2[^>]*>Synthetic notebook<\/h2>/u);
    expect(html).toContain('$12.00');
    expect(tag(html, 'form', 'data-cart-change-form', '')).toMatchObject({ method: 'post', action: '/cart/change' });
    expect(tag(html, 'input', 'name', 'id').value).toBe('synthetic-notebook');
    expect(tag(html, 'input', 'data-guest-cart-qty', 'synthetic-notebook').value).toBe('1');
  });

  it('renders named shipping and billing controls with native autocomplete and country choices', async () => {
    const html = await renderCheckout();
    for (const kind of ['delivery', 'billing']) {
      for (const [field, dataField, auto] of [['region', 'region', 'address-level1'], ['postalCode', 'postal-code', 'postal-code']]) {
        const input = tag(html, 'input', 'name', `${kind}[${field}]`);
        expect(input).toHaveProperty(`data-guest-cart-${kind}-${dataField}`);
        expect(input.autocomplete).toBe(`${kind === 'delivery' ? 'shipping' : 'billing'} ${auto}`);
      }
      expect(tag(html, 'select', 'name', `${kind}[country]`).autocomplete).toBe(`${kind === 'delivery' ? 'shipping' : 'billing'} country`);
    }
    const deliveryOptions = html.match(/<select[^>]*name="delivery\[country\]"[^>]*>([\s\S]*?)<\/select>/u)![1];
    const billingOptions = html.match(/<select[^>]*name="billing\[country\]"[^>]*>([\s\S]*?)<\/select>/u)![1];
    expect(tag(deliveryOptions, 'option', 'value', 'US')).not.toHaveProperty('disabled');
    expect(deliveryOptions).toContain('Canada (coming soon)');
    expect(deliveryOptions).not.toContain('value="CA"');
    expect(tag(billingOptions, 'option', 'value', 'CA')).not.toHaveProperty('disabled');
    expect(html).toContain('4242 4242 4242 4242');
    expect(tag(html, 'form', 'action', '/checkout').method).toBe('post');
    expect(tag(html, 'form', 'action', '/checkout')).toHaveProperty('novalidate');
    expect(html.match(/<form\b/gu)).toHaveLength(1);
  });

  it('renders one visible, editable review and usable native payment controls without hydration', async () => {
    const html = await renderCheckout();
    const nodes = elements(html);
    const withAttribute = (attribute: string) => nodes.filter(node => Object.hasOwn(node.attributes, attribute));
    expect(withAttribute('data-checkout-manifest')).toHaveLength(1);
    expect(withAttribute('data-checkout-manifest')[0].attributes).not.toHaveProperty('hidden');
    expect(withAttribute('data-guest-cart-lines')).toHaveLength(1);
    expect(withAttribute('data-guest-cart-subtotal-amount')).toHaveLength(1);
    expect(html).toContain('Synthetic notebook');
    expect(html).toContain('$12.00');
    expect(tag(html, 'a', 'data-checkout-edit-cart', '').href).toBe('/cart');
    expect(tag(html, 'a', 'data-checkout-back-to-cart', '').href).toBe('/cart');
    const form = tag(html, 'form', 'data-checkout-form', '');
    expect(form).toMatchObject({ action: '/checkout', method: 'post' });
    expect(form).not.toHaveProperty('hidden');
    expect(tag(html, 'button', 'data-guest-cart-checkout', '')).not.toHaveProperty('disabled');
    expect(tag(html, 'fieldset', 'data-guest-cart-contact', '')).not.toHaveProperty('disabled');
    expect(html).not.toContain('Checkout needs JavaScript');
    expect(html).not.toContain('data-checkout-no-script');
  });

  it('renders a refused postal field with one associated correction and safely retained values', async () => {
    const html = await renderCheckout({ values: { email: 'synthetic@example.test', 'delivery[name]': 'A "quoted" <shopper>', 'delivery[postalCode]': '', billingSame: 'on' }, error: { field: 'delivery[postalCode]', message: 'Enter your delivery postal code.' } });
    const invalid = tag(html, 'input', 'name', 'delivery[postalCode]');
    expect(invalid).toMatchObject({ 'aria-invalid': 'true', 'aria-describedby': 'guest-cart-delivery-postal-code-error' });
    expect(invalid).toHaveProperty('autofocus');
    expect(tag(html, 'p', 'id', 'guest-cart-delivery-postal-code-error').role).toBe('alert');
    expect(html.match(/aria-invalid="true"/gu)).toHaveLength(1);
    expect(tag(html, 'input', 'name', 'email').value).toBe('synthetic@example.test');
    expect(tag(html, 'input', 'name', 'delivery[name]').value).toBe('A "quoted" <shopper>');
    expect(elements(html).some(node => node.name === 'shopper')).toBe(false);
    expect(tag(html, 'input', 'name', 'billingSame')).toHaveProperty('checked');
    const separate = await renderCheckout({ values: { billingSame: '' } });
    expect(tag(separate, 'input', 'name', 'billingSame')).not.toHaveProperty('checked');
  });

  it('keeps billing but omits physical-delivery controls for a digital basket', async () => {
    const html = await renderCheckout({ page: { ...page, view: { ...view, needsDelivery: false } } });
    expect(html).not.toContain('name="delivery[');
    expect(html).not.toContain('name="billingSame"');
    expect(tag(html, 'input', 'name', 'billing[postalCode]').autocomplete).toBe('billing postal-code');
    expect(tag(html, 'select', 'name', 'billing[country]').autocomplete).toBe('billing country');
  });

  it('freezes contact fields and offers the existing payment instead of another submit', async () => {
    const html = await renderCheckout({ page: { ...page, paymentHeld: true, openPayment: 'https://checkout.example.test/existing' } });
    expect(elements(html).find(node => node.name === 'fieldset' && node.attributes['data-guest-cart-contact'] !== undefined)?.attributes).toHaveProperty('disabled');
    expect(html).toContain('href="https://checkout.example.test/existing"');
    expect(html).not.toContain('type="submit"');
  });

  it('offers a read-only status check while the cart is held without a payment link', async () => {
    const held = { ...page, paymentHeld: true };
    const checkout = await renderCheckout({ page: held });
    expect(tag(checkout, 'a', 'data-guest-cart-payment-status', '').href).toBe('/checkout');
    expect(tag(checkout, 'a', 'data-checkout-edit-cart', '').href).toBe('/cart');
    expect(checkout).toContain('View cart');
    expect(checkout).not.toContain('data-checkout-form');
    expect(checkout).not.toContain('data-guest-cart-resume');
    const container = await AstroContainer.create();
    const cart = await container.renderToString(Cart, { props: { page: held, checkoutAdmission: {} } });
    expect(tag(cart, 'a', 'data-guest-cart-payment-status', '').href).toBe('/cart');
    for (const attribute of ['qty', 'update', 'remove']) {
      expect(tag(cart, attribute === 'qty' ? 'input' : 'button', `data-guest-cart-${attribute}`, 'synthetic-notebook')).toHaveProperty('disabled');
    }
    expect(cart).not.toContain('data-guest-cart-proceed');
    expect(cart).not.toContain('data-guest-cart-resume');
  });

  it('renders native print guidance and paid details only for a confirmed order', async () => {
    const html = await renderReceipt({ kind: 'paid', order });
    expect(html).toContain('data-guest-checkout-order-number');
    expect(html).toContain('Order #7001');
    expect(html).toContain('data-guest-checkout-test');
    expect(html).toContain('Synthetic notebook × 1');
    expect(html).toContain('$12.00');
    expect(html).toContain('SYNTHETIC-TRACKING');
    expect(html).toContain('Use your browser’s Print or Save as PDF command');
    expect(html).not.toContain('data-guest-checkout-print');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('data-guest-checkout-status-retry');
  });

  it.each([
    { kind: 'confirming', refreshUrl: '/checkout/success?check=2', refreshSeconds: 3 },
    { kind: 'slow' }, { kind: 'no-cart' }, { kind: 'unavailable' },
  ] satisfies CheckoutReturn[])('never paints paid or print details in $kind', async result => {
    const html = await renderReceipt(result);
    expect(html).toContain(`data-guest-checkout-return-state="${result.kind}"`);
    expect(html).not.toContain('class="guest-checkout-receipt"');
    expect(html).not.toContain('data-guest-checkout-order-number');
    expect(html).not.toContain('Print or Save as PDF');
    if (result.kind === 'confirming') expect(html).toContain('href="/checkout/success?check=2"');
    if (result.kind === 'unavailable') expect(html).toContain('role="alert"');
  });
});
