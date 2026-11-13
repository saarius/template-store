import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const gallery = readFileSync('src/features/commerce-catalog/ProductGallery.astro', 'utf8');
const media = readFileSync('src/features/commerce-catalog/ProductMedia.astro', 'utf8');

describe('Server-rendered product gallery', () => {
  it('renders every approved picture without scripts, thumbnails or raw-file fallback', () => {
    expect(gallery).not.toMatch(/<script|<noscript|<button|data-gallery-thumb|data-gallery-open|\bhidden\b/);
    expect(gallery).toContain('.map((entry) => resolveCommerceImage(entry, resolver))');
    expect(gallery).toContain('pictures.slice(1).map');
    expect(gallery).toContain('alt={picture.alt}');
    expect(gallery).toContain('width={picture.width ?? 640} height={picture.height ?? 480} loading="lazy"');
    expect(gallery).not.toMatch(/localStorage|sessionStorage|checkout\/|window\.location/);
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
