import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/features/commerce-catalog/CommerceCatalog.astro', 'utf8');

describe('linked catalog card semantics', () => {
  it('uses the visible Commerce title as its name and current facts as its description', () => {
    expect(source).toContain('aria-labelledby={`${cardId}-title`}');
    expect(source).toContain('<h3 id={href ? `${cardId}-title` : undefined}>{product.name}</h3>');
    expect(source).toContain('aria-describedby={`${cardId}-facts`}');
    expect(source).toContain('class="shop-card__facts" id={href ? `${cardId}-facts` : undefined}');
    expect(source).not.toContain('aria-hidden');
    expect(source).not.toContain('aria-label=');
  });

  it('scopes references to a rendered card, not an item ID shared by separate shelves', () => {
    expect(source).toContain('const cardId = `commerce-card-${crypto.randomUUID()}`');
    expect(source).toContain('fallbackAlt={`${product.name} placeholder image`}');
    expect(source).toContain('href={href} aria-labelledby=');
    expect(source).toContain('{!href && <AddToCart product={product} />}');
  });
});
