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
  it('states the current checkout limit separately from future test instructions', () => {
    const guide = pages.find((p: any) => p.slug === 'test-store');
    const content = JSON.stringify(guide.sections);
    expect(content).toContain('Checkout is not connected yet');
    expect(content).toContain('4242 4242 4242 4242');
    expect(content).toContain('No real charges');
    expect(content).toContain('Never enter a real card');
    expect(content).not.toContain('sk_test_');
  });
  it('keeps field notes editable in EmDash Pages', () => {
    const notes = pages.filter((p: any) => p.slug.startsWith('field-note-'));
    expect(notes).toHaveLength(2);
    expect(notes.every((p: any) => p.sections.some(([style]: string[]) => style === 'h2'))).toBe(true);
  });
});
