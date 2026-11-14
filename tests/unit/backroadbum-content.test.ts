import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const catalog = JSON.parse(readFileSync('seed/backroadbum-catalog.json', 'utf8'));
const pages = JSON.parse(readFileSync('seed/backroadbum-pages.json', 'utf8'));
describe('Backroad Bum source-authored merchant content', () => {
  it('has unique product identities and valid USD seed prices', () => {
    expect(catalog).toHaveLength(5);
    for (const key of ['slug', 'sku']) expect(new Set(catalog.map((p: any) => p[key])).size).toBe(5);
    for (const p of catalog) {
      expect(p.sku).toMatch(/^BRB-[A-Z0-9-]+$/);
      expect(p.regular).toMatch(/^\d+(\.\d{1,2})?$/);
      if (p.sale) expect(Number(p.sale)).toBeLessThan(Number(p.regular));
      expect(p.specs).toContain('Demo design:');
      expect(readFileSync(`public/backroad/${p.art}.svg`, 'utf8')).toContain('<svg');
    }
  });
  it('explains current test checkout and browser-bound recovery without publishing credentials', () => {
    const guide = pages.find((p: any) => p.slug === 'test-store');
    const content = JSON.stringify(guide.sections);
    expect(content).toContain('Try a test purchase');
    expect(content).toContain('Your last checkout in the footer');
    expect(content).toContain('Only this browser’s latest checkout');
    expect(content).toContain('Email sign-in is paused because delivery is unavailable');
    expect(content).toContain('hosted DinkusKit Ship');
    expect(content).toContain('not a fulfillment timeline or tracking');
    expect(content).toContain('separate merchant step');
    expect(content).not.toMatch(/Browse five products|Ship label automation is not connected|receipt then shows Demo fulfillment complete/);
    expect(content).not.toContain('Checkout is not connected yet');
    expect(content).toContain('4242 4242 4242 4242');
    expect(content).toContain('No real charges');
    expect(content).toContain('Never enter a real card');
    expect(content).not.toContain('sk_test_');
  });
  it('keeps shipping aligned with hosted sandbox fulfillment and the signed guest receipt', () => {
    const content = JSON.stringify(pages.find((p: any) => p.slug === 'shipping').sections);
    expect(content).toContain('hosted DinkusKit Ship');
    expect(content).toContain('No live postage is bought');
    expect(content).toContain('not a fulfillment timeline or tracking');
    expect(content).not.toMatch(/automation is not connected|shown on the guest receipt as Demo fulfillment complete/);
  });
  it('keeps guide actions scoped to the published prose guide, not ordinary or missing pages', () => {
    const route = readFileSync('src/pages/[slug].astro', 'utf8');
    expect(route).toContain('Boolean(entry && slug === "test-store" && layout.length === 0)');
    expect(route).toContain('{testGuide && <TestStoreActions />}');
    const actions = readFileSync('src/features/store-shell/TestStoreActions.astro', 'utf8');
    expect(actions).toContain('href="/shop"');
    expect(actions).toContain('href="/checkout/success"');
    expect(actions).not.toMatch(/<script|localStorage|receiptId|capability/);
  });
  it('links policy support to the test guide without inventing shipping terms', () => {
    const support = JSON.parse(readFileSync('seed/backroadbum-policy-support.json', 'utf8'));
    expect(support.slug).toBe('policy-support-note');
    const paragraph = support.content.find((block: any) => block.style === 'normal');
    expect(paragraph.children.map((span: any) => span.text).join('')).toBe('For test-card details and checkout steps, read the Test-store guide.');
    expect(paragraph.markDefs).toEqual([{ _type: 'link', _key: 'guide', href: '/test-store', blank: false }]);
    expect(paragraph.children.find((span: any) => span.text === 'Test-store guide').marks).toEqual(['guide']);
    expect(JSON.stringify(support)).not.toMatch(/shipping charge|sk_test_|guaranteed/i);
  });
  it('keeps tee measurements illustrative, separate from Commerce facts and reachable without script', () => {
    const fit = JSON.parse(readFileSync('seed/backroadbum-tee-fit.json', 'utf8'));
    expect(fit.slug).toBe('wrong-turn-tee');
    expect(fit.rows.map((row: { label: string }) => row.label)).toEqual(['M', 'L', 'XL']);
    expect(fit.tableHeading).toContain('inches');
    expect(fit.instructions).toContain('Compare garment measurements, not body measurements');
    expect(fit.scope).toContain('not measurements of a manufactured sample');
    expect(fit.scope).toContain('Width is measured flat');
    expect(JSON.stringify(fit)).not.toMatch(/\$|in stock|sold out|shipping|guaranteed|sk_test_/i);
    expect(fit.link.href).toBe('#product-details');
    const route = readFileSync('src/pages/products/[id].astro', 'utf8');
    expect(route).toContain('{details && <section id="product-details" tabindex="-1"');
    expect(route.match(/id="product-details"/g)).toHaveLength(1);
  });
  it('records fleece authoring intent without turning fit copy into commerce authority', () => {
    const fit = JSON.parse(readFileSync('seed/backroadbum-fleece-fit.json', 'utf8'));
    expect(fit.slug).toBe('last-light-fleece');
    expect(fit.rows.map((row: { label: string }) => row.label)).toEqual(['M', 'L', 'XL']);
    expect(fit.tableHeading).toContain('inches');
    expect(fit.paragraphs.join(' ')).toContain('not measurements of a manufactured sample');
    expect(fit.paragraphs.join(' ')).toContain('Compare garment measurements, not body measurements');
    expect(fit.paragraphs.join(' ')).toContain('not technical weather protection');
    expect(JSON.stringify([fit.summary, fit.paragraphs, fit.rows])).not.toMatch(/\$|in.stock|on.backorder|ships? (in|by)|guaranteed|sk_test_/i);
    expect(fit.variants[0]).toEqual({ label: 'M', sku: 'BRB-FLEECE-M', regularMinor: '6800', stockStatus: 'in-stock' });
    expect(new Set(fit.variants.map((variant: { sku: string }) => variant.sku)).size).toBe(3);
    expect(fit.variants.at(-1).stockStatus).toBe('on-backorder');
    const route = readFileSync('src/pages/products/[id].astro', 'utf8');
    expect(route).not.toContain('backroadbum-fleece-fit');
    expect(readFileSync('scripts/verify-backroadbum-fleece.mjs', 'utf8')).toContain('catalog/public/item?itemId=');
  });
  it('keeps selected-pill decoration out of the accessible option name', () => {
    const route = readFileSync('src/pages/products/[id].astro', 'utf8');
    expect(route).toContain('<span class="product-variant__check" aria-hidden="true">✓</span>');
    expect(route).toContain('data-variant-choice data-variant-option={option.label}');
    expect(route).not.toMatch(/::before\{content:['"]✓/);
    expect(route).toContain('.product-variant:has(input:focus-visible)');
    expect(route).toContain('min-height:48px;min-width:64px');
  });
  it('keeps field notes editable in EmDash Pages', () => {
    const notes = pages.filter((p: any) => p.slug.startsWith('field-note-'));
    expect(notes).toHaveLength(4);
    expect(new Set(notes.map((p: any) => p.slug)).size).toBe(notes.length);
    expect(notes.every((p: any) => p.sections.some(([style]: string[]) => style === 'h2'))).toBe(true);
    const reset = notes.find((p: any) => p.slug === 'field-note-wet-gear-reset');
    expect(JSON.stringify(reset.sections)).toContain('care instructions');
    expect(JSON.stringify(reset.sections)).toContain('fully dry');
    expect(JSON.stringify(reset.sections)).not.toMatch(/\$\d|waterproof|guaranteed/i);
    const lunch = notes.find((p: any) => p.slug === 'field-note-lunch-stop');
    expect(lunch.title).toBe('A lunch stop worth taking');
    expect(lunch.sections.filter(([style]: string[]) => style === 'h2')).toHaveLength(4);
    const prose = JSON.stringify(lunch.sections);
    for (const guidance of ['stopping is permitted', 'safe temperature', 'Do not feed animals', 'Take food waste home']) {
      expect(prose).toContain(guidance);
    }
    expect(prose).not.toMatch(/\$\d|field-tested|guaranteed|buy now/i);
  });
});
