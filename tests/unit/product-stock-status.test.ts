import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/pages/products/[id].astro', 'utf8');

describe('Product option stock feedback', () => {
  it('renders a persistent atomic status region before options can change it', () => {
    const message = page.match(/<p class="product-detail__status"[\s\S]*?<\/p>/)?.[0];
    expect(message).toContain('role={variants.length ? "status" : undefined}');
    expect(message).toContain('aria-atomic={variants.length ? "true" : undefined}');
    expect(message).toContain('>{status}</p>');
    // role=status implicitly supplies aria-live=polite. No alert/focus interruption.
    expect(message).not.toMatch(/role="alert"|tabindex=/);
  });

  it('updates the retained status rather than replacing its live-region node', () => {
    const update = page.match(/if \(status\) \{([\s\S]*?)\n    \}/)?.[1];
    expect(update).toContain('status.textContent = view.status');
    expect(update).toContain('status.setAttribute("data-availability-status", view.availability)');
    expect(update).not.toMatch(/outerHTML|replaceWith|\.focus\(|setAttribute\("role"/);
  });
});
