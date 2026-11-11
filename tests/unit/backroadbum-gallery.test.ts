import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const gallery = readFileSync('src/features/commerce-catalog/ProductGallery.astro', 'utf8');

describe('Product gallery progressive browsing', () => {
  it('keeps interactive controls hidden until a main picture can be enhanced', () => {
    expect(gallery).toContain('aria-label="Product pictures" data-gallery-controls hidden');
    expect(gallery).toContain('.product-gallery__thumbs[hidden]{display:none}');
    expect(gallery).toContain('if (main && controls) controls.hidden = false');
    expect(gallery.indexOf('thumb.addEventListener("click"')).toBeLessThan(gallery.indexOf('controls.hidden = false'));
  });

  it('offers resolved public picture links instead of inert controls without JavaScript', () => {
    const fallback = gallery.split('<noscript>')[1].split('</noscript>')[0];
    expect(fallback).toContain('href={picture.src} data-gallery-open');
    expect(fallback).toContain('aria-label={`Open picture ${index + 1} of ${pictures.length}');
    expect(fallback).toContain('browser’s Back button');
    expect(fallback).not.toContain('<button');
    expect(fallback).not.toMatch(/target=|download|picture\.id|storageKey/);
    expect(gallery).toContain('.map((entry) => resolveCommerceImage(entry, resolver))');
    expect(gallery).toContain('{pictures.length > 1 && (');
  });

  it('preserves the existing main-image, alt-text and pressed-state selection without cart writes', () => {
    for (const text of ['main.src = thumb.dataset.src', 'main.srcset = thumb.dataset.srcset', 'main.alt = thumb.dataset.alt', 'other.setAttribute("aria-pressed", String(other === thumb))']) expect(gallery).toContain(text);
    expect(gallery).not.toMatch(/localStorage|sessionStorage|checkout\/|\.focus\(|window\.location/);
  });
});
