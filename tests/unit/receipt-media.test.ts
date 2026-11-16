import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readCommerceCatalogSnapshots } from '../../src/features/commerce-catalog/index.js';
import { withReceiptCatalogMedia } from '../../src/features/guest-cart/receipt-media.js';
import { confirmedOrderView } from '../../src/features/guest-cart/order-view.js';
import { guestCheckoutWire, parseGuestCheckoutWireResult, type GuestCheckoutProjection } from '../../src/features/guest-cart/checkout-protocol.js';

vi.mock('../../src/features/commerce-catalog/index.js', () => ({ readCommerceCatalogSnapshots: vi.fn() }));
const read = vi.mocked(readCommerceCatalogSnapshots);
const context = { request: new Request('https://store.example.test/api/checkout/status'), runtime: {} as never };
const checkout = (): GuestCheckoutProjection => ({
  schema: 'dinkuskit.commerce.guest-checkout-projection/v1', state: 'paid', attemptId: 'attempt-fixture',
  redirectUrl: null, retryAfter: null,
  order: { orderId: 'order:opaque-fixture', receiptId: 'receipt:fixture', number: 1001, test: true,
    lines: [{ id: 'mug', quantity: 2, name: 'Frozen mug', sku: 'FROZEN-SKU', variant: 'Enamel', unitPrice: { currency: 'USD', minor: '1600' } }],
    total: { currency: 'USD', minor: '3200' } },
});
const snapshot = (patch = {}) => ({ id: 'mug', found: true as const, name: 'Current name', sku: 'CURRENT-SKU', fulfillment: 'physical' as const,
  price: { listable: true, regularText: '$14.00', saleText: null }, availability: { status: 'out-of-stock', listable: true, sellable: false },
  thumbnail: { src: '/backroad/mug.svg', alt: 'Current public illustration' }, ...patch });

beforeEach(() => { read.mockReset(); });
describe('optional paid receipt artwork', () => {
  it('fills only media through an exact published catalog member, including when sold out; leaves all frozen facts intact', async () => {
    const before = checkout(); const frozen = structuredClone(before);
    read.mockResolvedValue([snapshot()]);
    const enriched = await withReceiptCatalogMedia(before, context);
    expect(read).toHaveBeenCalledWith(['mug'], context);
    expect(enriched.order?.lines[0]).toEqual({ ...before.order!.lines[0], imageUrl: '/backroad/mug.svg', imageAlt: 'Current public illustration' });
    expect({ ...enriched, order: { ...enriched.order, lines: before.order!.lines } }).toEqual(before);
    expect(before).toEqual(frozen);
    const parsed = parseGuestCheckoutWireResult({ ok: true, capabilityId: 'fixture', checkout: guestCheckoutWire(enriched) });
    if (!parsed?.ok) throw Error('relay must parse');
    expect(confirmedOrderView(parsed.checkout)).toMatchObject({ orderNumber: '#1001', test: true,
      lines: [{ text: 'Frozen mug × 2', sku: 'FROZEN-SKU', variant: 'Enamel', amount: '$32.00', thumbnail: { src: '/backroad/mug.svg' } }],
      totals: [{ label: 'Total', amount: '$32.00' }] });
  });
  it.each(['pending', 'released-retry', 'recoverable-failure'] as const)('does no optional lookup for %s, even with a stray order', async state => {
    const before = { ...checkout(), state }; expect(await withReceiptCatalogMedia(before, context)).toBe(before); expect(read).not.toHaveBeenCalled();
  });
  it('does no lookup for an empty order or an already safe frozen image', async () => {
    const none = { ...checkout(), order: null }; expect(await withReceiptCatalogMedia(none, context)).toBe(none);
    const before = checkout(); const withImage = { ...before, order: { ...before.order!, lines: [{ ...before.order!.lines[0]!, imageUrl: '/frozen.svg', imageAlt: 'Frozen' }] } };
    expect(await withReceiptCatalogMedia(withImage, context)).toBe(withImage); expect(read).not.toHaveBeenCalled();
  });
  it.each([
    [{ id: 'mug', found: false }],
    [snapshot({ id: 'other' })],
    [snapshot({ thumbnail: null })],
    [snapshot({ price: { listable: false }, availability: { listable: false } })],
    [snapshot({ thumbnail: { src: 'javascript:alert(1)', alt: 'Unsafe' } })],
  ])('never guesses or uses unavailable/unsafe media (%j)', async snapshots => {
    read.mockResolvedValue(snapshots as never); const before = checkout();
    expect((await withReceiptCatalogMedia(before, context)).order?.lines).toEqual(before.order?.lines);
  });
  it('drops optional artwork instead of exceeding the bounded receipt transport', async () => {
    const before = checkout();
    const lines = Array.from({ length: 24 }, (_, index) => ({ ...before.order!.lines[0]!, id: `item-${index}`, name: 'n'.repeat(1024) }));
    const large = { ...before, order: { ...before.order!, lines } };
    read.mockResolvedValue(lines.map(line => snapshot({ id: line.id, thumbnail: { src: '/' + 'x'.repeat(2047), alt: 'Public artwork' } })));
    expect(await withReceiptCatalogMedia(large, context)).toBe(large);
  });
  it('catalog outages keep the paid order and amount, not a payment failure', async () => {
    read.mockImplementation(async () => { throw new Error('unavailable'); });
    const before = checkout(); expect(await withReceiptCatalogMedia(before, context)).toBe(before);
  });
});

describe('receipt identity is supplied, never guessed', () => {
  it('keeps number and TEST independent, with the same heading on server and retained views', () => {
    const before = checkout(); expect(confirmedOrderView(before)).toMatchObject({ orderNumber: '#1001', test: true });
    expect(confirmedOrderView({ ...before, order: { ...before.order!, test: false } })).toMatchObject({ orderNumber: '#1001', test: false });
    const { number: _number, test: _test, ...legacy } = before.order!;
    expect(confirmedOrderView({ ...before, order: legacy })).toMatchObject({ orderNumber: 'opaque-fixture', test: false });
  });
  it.each([0, -1, 1001.5, Number.MAX_SAFE_INTEGER + 1])('rejects an invalid optional number %s without taking digits from an ID', number => {
    const before = checkout(); expect(confirmedOrderView({ ...before, order: { ...before.order!, number } })?.orderNumber).toBe('opaque-fixture');
  });
});
