import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');
const content = read('src/features/store-shell/MissingPageContent.astro');

describe('Backroad Bum missing-page recovery', () => {
  it('provides native search and current destinations without inferring an address or payment state', () => {
    expect(content).toContain('method="get" action="/search"');
    expect(content).toContain('type="search" name="q" minlength="2" maxlength="120" required');
    expect(content).toContain('label for="missing-page-search"');
    for (const href of ['/shop', '/field-notes', '/checkout/success']) expect(content).toContain(`href="${href}"`);
    expect(content).toContain('Only its latest checkout can be reopened');
    expect(content).toContain('checks whether a receipt is available');
    expect(content).not.toMatch(/<script|localStorage|sessionStorage|Astro\.url|Astro\.request|autofocus|history\.back|checkout\/start|paid successfully/i);
  });

  it('serves a real unindexed 404 without a false canonical URL or framework screen', () => {
    const route = read('src/pages/404.astro');
    expect(route).toContain('Astro.response.status = 404');
    expect(route).toContain("Astro.response.headers.set('Cache-Control', 'no-store')");
    expect(route).toContain('<BackroadPage title="Page not found" noindex>');
    expect(route).toContain('<MissingPageContent />');
    const shell = read('src/features/store-shell/BackroadPage.astro');
    expect(shell).toContain('noindex = false');
    expect(shell).toContain('{noindex ? <meta name="robots" content="noindex, follow" /> : <link rel="canonical"');
  });

  it('reuses recovery for CMS, product and collection misses while preserving route status decisions', () => {
    const cms = read('src/pages/[slug].astro');
    expect(cms).toContain('if (!entry) Astro.response.status = 404');
    expect(cms).toContain('<MissingPageContent />');
    const product = read('src/pages/products/[id].astro');
    expect(product).toContain('if (!item) Astro.response.status = 404');
    expect(product).toContain('<MissingPageContent title="Product not found"');
    expect(product).toContain('Astro.response.status = lookupUnavailable ? 503 : linkedProduct ? 200 : 404');
    expect(product).toContain('data-product-removed');
    expect(product).toContain('Astro.response.status === 404 ? <meta name="robots" content="noindex, follow"');
    const category = read('src/pages/categories/[slug].astro');
    expect(category).toContain('if (!category) Astro.response.status = 404');
    expect(category).toContain('noindex={!category}');
    expect(category).toContain('<MissingPageContent title="That collection isn’t here."');
  });
});
