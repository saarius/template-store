// Read-only dashboard navigation check. No admin, provider or shopper capabilities.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STORE_URL || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/dashboard/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const writes = [];
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
    const sizes = {};
    for (const [view, path, active] of [
      ['overview', '/dashboard/', 'Overview'],
      ['history', '/dashboard/history/', 'Build history'],
      ['contributions', '/dashboard/contributions/', 'Contributions'],
    ]) {
      const response = await page.goto(base + path);
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toBe('no-store');
      await page.evaluate(async () => { await document.fonts.ready; document.documentElement.style.scrollBehavior = 'auto'; });
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('[data-dashboard-view]')).toHaveAttribute('data-dashboard-view', view);
      const nav = page.getByRole('navigation', { name: 'Dashboard pages', exact: true });
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(nav.getByRole('link', { name: active, exact: true })).toHaveAttribute('aria-current', 'page');
      sizes[view] = (await response.body()).length;
      if (view === 'overview') {
        await expect(page.locator('.cycle-entry')).toHaveCount(0);
        await expect(page.locator('table')).toHaveCount(0);
        await expect(page.locator('[data-activity-metrics] dt')).toHaveCount(15);
        await expect(page.getByRole('link', { name: 'Original · captured November 9, 2026', exact: true })).toHaveAttribute('href', '/dashboard/instructions/original-2026-11-09.txt');
        await expect(page.getByRole('link', { name: 'Steer 1 · November 10, 2026', exact: true })).toHaveAttribute('href', '/dashboard/instructions/steer-1-2026-11-10.txt');
        await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('link', { name: 'Latest work', exact: true }).click();
        await page.waitForURL(url => url.hash === '#history');
        await expect(page.locator('#history').getByRole('link', { name: 'Read the full build history', exact: true })).toHaveAttribute('href', '/dashboard/history/');
      } else if (view === 'history') {
        expect(await page.locator('.cycle-entry').count()).toBeGreaterThanOrEqual(76);
        await expect(page.locator('.cycle-entry').first()).toContainText('Two sizes, one paid order');
        await expect(page.locator('.cycle-entry').last()).toContainText('November 9');
        await expect(page.locator('table')).toHaveCount(0);
        await expect(page.locator('[data-activity-metrics]')).toHaveCount(0);
        await page.locator('.cycle-entry').first().scrollIntoViewIfNeeded();
      } else {
        await expect(page.locator('.cycle-entry')).toHaveCount(0);
        await expect(page.locator('table')).toHaveCount(3);
        const candidates = page.getByRole('table', { name: 'Framework candidates · release state is separate', exact: true });
        await expect(candidates.locator('tbody tr')).toHaveCount(13);
        await expect(candidates.locator('tr').filter({ hasText: 'fix/order-variant-labels' })).toContainText('signed store plugin is unchanged');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/product-control-readiness' })).toContainText('aggregate checks pass');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/checkout-contact-feedback' })).toContainText('queued with no jobs');
        await expect(page.locator('[data-activity-metrics]')).toHaveCount(0);
        await page.locator('#contributions').scrollIntoViewIfNeeded();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const secret of ['sk_test_', 'whsec_', 'github_pat_', '/var/lib/', 'session_file']) await expect(page.locator('main')).not.toContainText(secret);
      await page.screenshot({ path: new URL(`${view}-${width}.png`, output).pathname });
      if (view !== 'overview') {
        await page.getByRole('navigation', { name: 'Return to the overview' }).getByRole('link').click();
        await page.waitForURL(url => /^\/dashboard\/?$/.test(url.pathname));
        await expect(page.locator('[data-dashboard-view]')).toHaveAttribute('data-dashboard-view', 'overview');
      }
    }
    expect(sizes.overview).toBeLessThan(sizes.history);
    expect(writes).toEqual([]);
    results.push({ width, javaScriptEnabled: false, views: 3, archiveMinimum: 76, candidateRows: 13, currentNavigation: true, noOverflow: true, privateFieldsAbsent: true, writes: 0, bytes: sizes });
    await context.close();
  }
  await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
