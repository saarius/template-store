import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Backroad Bum dashboard route boundaries', () => {
  it('separates saved-cart, variant and checkout-form proof from payment readiness and deployment claims', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('Hosted checkout settings #124');
    expect(source).toContain('Forty-four synthetic captures across eleven UI PRs');
    expect(source).toContain('Checkout contact #223');
    expect(source).toContain('synthetic checkout protocol and an admission flag');
    expect(source).toContain('its own edits clear the correction without moving focus');
    expect(source).toContain('draft/on hold for the server-held-cart decision');
    expect(source).toContain('Cart return #220');
    expect(source).toContain('trusted browser tab returns');
    expect(source).toContain('same saved intent and focused quantity element');
    expect(source).toContain('one worker, disclosed 15-second local timeout');
    expect(source).toContain('not a new signed installation, real BFCache restoration or payment-readiness proof');
    expect(source).toContain('Saved-cart names #218');
    expect(source).toContain('without snapshot interception');
    expect(source).toContain('not a signed installation or payment-readiness proof');
    expect(source).toContain('Variant cards #216');
    expect(source).toContain('the isolated fixture does not prove payment readiness');
    expect(source).toContain('fixed-label assertion against captured results fails on main and passes on head');
    expect(source).toContain('not a new signed installation or hosted settings submission');
    expect(source).toContain('normal November 12 stop at 22:24 UTC');
    expect(source).toContain('do not prove continuous uptime or background-job drain');
    expect(source).toContain('initial activation was not a live shutdown test');
  });

  it('keeps instruction versions ordered and archives the live-dependency guard', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const archivePaths = [...source.matchAll(/href="(\/dashboard\/instructions\/[^" ]+)"/g)].map(match => match[1]);
    expect(archivePaths).toEqual([
      '/dashboard/instructions/original-2026-11-09.txt',
      '/dashboard/instructions/steer-1-2026-11-10.txt',
      '/dashboard/instructions/steer-2-2026-11-11.txt',
      '/dashboard/instructions/steer-3-2026-11-12.txt',
    ]);
    const steer = readFileSync('public' + archivePaths[2], 'utf8');
    expect(steer).toContain('## Owner Steer 2 — November 11, 2026');
    expect(steer).toContain('clean pushed branch and local verification is complete');
    for (const directory of ['node_modules', '.artifacts', 'dist', '.astro', 'test-results']) expect(steer).toContain('`' + directory + '`');
    expect(steer).toContain('Never remove `node_modules` from the primary');
    expect(steer).toContain('once their upstream PRs merge or close');
    for (const path of archivePaths.slice(0, 2)) expect(readFileSync('public' + path, 'utf8')).not.toContain('Owner Steer 2');
    const mediaSteer = readFileSync('public' + archivePaths[3], 'utf8');
    expect(mediaSteer).toContain('Owner Steer 3 — November 12, 2026');
    expect(mediaSteer).toContain('Before (unchanged `main`) and After (PR head)');
    expect(mediaSteer).toContain('@clawsweeper re-review');
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
