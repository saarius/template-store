import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const gallery = readFileSync('src/features/commerce-catalog/ProductGallery.astro', 'utf8');
const media = readFileSync('src/features/commerce-catalog/ProductMedia.astro', 'utf8');

describe('Server-rendered product gallery', () => {
  it('renders every approved picture without scripts, thumbnails or unverified fallback', () => {
    expect(gallery).not.toMatch(/<script|<noscript|<button|data-gallery-thumb|data-gallery-open|\shidden(?:[=>\s])/);
    expect(gallery).toContain('.map((entry) => resolveCommerceImage(entry, resolver))');
    expect(gallery).toContain('pictures.slice(1).map');
    expect(gallery).toContain('alt={picture.alt}');
    expect(gallery).toContain('width={picture.width ?? 640} height={picture.height ?? 480} loading="lazy"');
    expect(gallery).not.toMatch(/localStorage|sessionStorage|checkout\/|window\.location/);
  });

  it('offers approved original images as native, descriptive new-tab links', () => {
    expect(gallery).toContain('pictures.length > 0 && <nav');
    expect(gallery).toContain('aria-label="Full-size product pictures"');
    expect(gallery).toContain('href={picture.src} target="_blank" rel="noopener"');
    expect(gallery).toContain('Open full-size image ${index + 1} of ${pictures.length}: ${picture.alt} (new tab)');
    expect(gallery).toContain('min-height: 48px');
    expect(gallery).not.toContain('href={fallbackSrc}');
  });

  it('prioritizes only the product lead while cards keep lazy loading', () => {
    expect(gallery).toContain('fallbackAlt={fallbackAlt} priority');
    expect(media).toContain('priority = false');
    expect(media).toContain('loading={priority ? "eager" : "lazy"}');
    expect(media).toContain('fetchpriority={priority ? "high" : undefined}');
    expect(media).toContain('data-pigment-drift="product-media"');
  });

  it('confines the phone strip to multi-picture products and retains the desktop grid', () => {
    expect(gallery).toContain('const multiple = pictures.length > 1;');
    expect(gallery).toContain('role={multiple ? "region" : undefined}');
    expect(gallery).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(gallery).toContain('scroll-snap-type: x mandatory');
    expect(gallery).toContain('flex: 0 0 88%');
    expect(gallery).toContain('align-items: flex-start');
  });
});
