import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The rendered consumer test supplies contrast/interaction proof; these checks
// keep the generic chalk repair from freezing adaptive merchant surfaces Light.
describe('merchant and starter Account surface schemes', () => {
  it('retains the fixed-chalk starter contract', () => {
    const source = readFileSync('src/features/shopper-account/ShopperAccount.astro', 'utf8');
    const stamp = source.match(/\.account-card--stamp \{[\s\S]*?\}/)?.[0];
    const status = source.match(/\[data-account-status\] \{[\s\S]*?\}/)?.[0];
    expect(stamp).toContain('color-scheme: light');
    expect(stamp).toContain('background: #fcfbf8');
    expect(status).toContain('color-scheme: light');
    expect(status).toContain('color: var(--store-ink)');
  });

  it('lets only adaptive merchant cards/status inherit the selected page scheme', () => {
    const css = readFileSync('src/features/shopper-account/account-screen.css', 'utf8');
    expect(css).toContain('body .shopper-account[data-merchant-account] .account-card,\nbody .shopper-account[data-merchant-account] [data-account-status]{color-scheme:inherit}');
    expect(css).toContain('background:var(--color-surface)');
    expect(css).toContain('color:var(--color-text)');
  });
});
