import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APPEARANCE_KEY, appearance, saveAppearance } from '../../src/features/store-shell/theme-client';

describe('merchant appearance preference', () => {
  it('defaults to System and accepts only explicit Light/Dark', () => {
    for (const value of [undefined, null, '', 'system', 'LIGHT', 'aizome', '<script>']) expect(appearance(value)).toBe('system');
    expect(appearance('light')).toBe('light');
    expect(appearance('dark')).toBe('dark');
  });
  it('writes only the appearance key and removes it for System', () => {
    const calls: unknown[][] = [];
    const storage = { setItem: (...args: string[]) => { calls.push(['set', ...args]); }, removeItem: (...args: string[]) => { calls.push(['remove', ...args]); } };
    expect(saveAppearance(storage, 'dark')).toBe(true);
    expect(saveAppearance(storage, 'light')).toBe(true);
    expect(saveAppearance(storage, 'system')).toBe(true);
    expect(calls).toEqual([['set', APPEARANCE_KEY, 'dark'], ['set', APPEARANCE_KEY, 'light'], ['remove', APPEARANCE_KEY]]);
  });
  it('tolerates unavailable storage for every choice', () => {
    const storage = { setItem() { throw new Error('Blocked'); }, removeItem() { throw new Error('Blocked'); } };
    for (const mode of ['system', 'light', 'dark'] as const) expect(saveAppearance(storage, mode)).toBe(false);
  });
  it('bootstraps every bespoke store head and the shared page wrapper', () => {
    const files = ['index', 'cart', 'account', 'shipping', 'returns', '[slug]', 'products/[id]', 'checkout/index', 'checkout/success', 'proof', 'playground-tour', 'connect-to-dinkuskit'];
    for (const name of files) {
      const source = readFileSync(`src/pages/${name}.astro`, 'utf8');
      expect(source, name).toContain('<ThemeHead />');
      expect(source.indexOf('<ThemeHead />'), name).toBeGreaterThan(source.indexOf('<head>'));
    }
    expect(readFileSync('src/features/store-shell/BackroadPage.astro', 'utf8')).toContain('<head><ThemeHead />');
    const bootstrap = readFileSync('src/features/store-shell/ThemeHead.astro', 'utf8');
    expect(bootstrap).toContain("let mode = 'system'");
    expect(bootstrap).toContain("getItem('backroadbum.theme')");
    expect(bootstrap).not.toMatch(/fetch\(|cookie|checkout\/guest|cart\.v/u);
  });
});
