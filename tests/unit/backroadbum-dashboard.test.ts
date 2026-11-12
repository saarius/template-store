import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Backroad Bum dashboard route boundaries', () => {
  it('keeps instruction versions ordered and archives the live-dependency guard', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const archivePaths = [...source.matchAll(/href="(\/dashboard\/instructions\/[^" ]+)"/g)].map(match => match[1]);
    expect(archivePaths).toEqual([
      '/dashboard/instructions/original-2026-11-09.txt',
      '/dashboard/instructions/steer-1-2026-11-10.txt',
      '/dashboard/instructions/steer-2-2026-11-11.txt',
    ]);
    const steer = readFileSync('public' + archivePaths[2], 'utf8');
    expect(steer).toContain('## Owner Steer 2 — November 11, 2026');
    expect(steer).toContain('clean pushed branch and local verification is complete');
    for (const directory of ['node_modules', '.artifacts', 'dist', '.astro', 'test-results']) expect(steer).toContain('`' + directory + '`');
    expect(steer).toContain('Never remove `node_modules` from the primary');
    expect(steer).toContain('once their upstream PRs merge or close');
    for (const path of archivePaths.slice(0, 2)) expect(readFileSync('public' + path, 'utf8')).not.toContain('Owner Steer 2');
  });

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
