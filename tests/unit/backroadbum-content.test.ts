import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const catalog = JSON.parse(readFileSync('seed/backroadbum-catalog.json', 'utf8'));
const pages = JSON.parse(readFileSync('seed/backroadbum-pages.json', 'utf8'));
describe('Backroad Bum initial merchant content', () => {
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
  it('keeps field notes editable in EmDash Pages', () => {
    const notes = pages.filter((p: any) => p.slug.startsWith('field-note-'));
    expect(notes).toHaveLength(3);
    expect(new Set(notes.map((p: any) => p.slug)).size).toBe(notes.length);
    expect(notes.every((p: any) => p.sections.some(([style]: string[]) => style === 'h2'))).toBe(true);
    const reset = notes.find((p: any) => p.slug === 'field-note-wet-gear-reset');
    expect(JSON.stringify(reset.sections)).toContain('care instructions');
    expect(JSON.stringify(reset.sections)).toContain('fully dry');
    expect(JSON.stringify(reset.sections)).not.toMatch(/\$\d|waterproof|guaranteed/i);
  });
});
