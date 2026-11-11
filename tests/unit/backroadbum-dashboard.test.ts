import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Backroad Bum dashboard route boundaries', () => {
  it.each([
    ['index', '<DashboardReport />'],
    ['history', '<DashboardReport view="history" />'],
    ['contributions', '<DashboardReport view="contributions" />'],
  ])('keeps %s dynamic and sets no-store in the page, not its child component', (route, view) => {
    const source = readFileSync(`src/pages/dashboard/${route}.astro`, 'utf8');
    expect(source).toContain('export const prerender = false;');
    expect(source).toContain("Astro.response.headers.set('Cache-Control', 'no-store');");
    expect(source).toContain(view);
  });
});
