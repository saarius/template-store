// Read-only dashboard navigation check. No admin, provider or shopper capabilities.
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/features/experiment-report/DashboardReport.astro', import.meta.url), 'utf8');
const historyTitles = [...source.matchAll(/<article class="cycle-entry"><h3>([^<]+)<\/h3>/g)].map(match => match[1]);
expect(historyTitles.length).toBeGreaterThan(0);
const steer2Path = '/dashboard/instructions/steer-2-2026-11-11.txt';
const steer2Text = await readFile(new URL('../public' + steer2Path, import.meta.url), 'utf8');
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
        const collections = page.locator('.status-list > div').filter({ hasText: 'Collection discovery' });
        await expect(collections).toContainText('unused starter Tees, Hats and Hoodies retained as private drafts');
        await expect(page.locator('#history')).toContainText('stable Block Kit identities');
        await expect(page.locator('#history')).toContainText('the signed plugin is unchanged');
        await expect(page.locator('.status-list > div').filter({ hasText: 'Catalog shipping weights' })).toContainText('not measured samples');
        await expect(page.locator('#emdash-bugs li')).toHaveCount(7);
        await expect(page.locator('#emdash-bugs')).toContainText('Reopen Shipping');
        await expect(page.locator('.status-list > div').filter({ hasText: 'Contact corrections' })).toContainText('validation and payment guards unchanged');
        const recovery = page.locator('.status-list > div').filter({ hasText: 'Recovery coverage' });
        await expect(recovery).toContainText('encrypted settings recovered locally');
        await expect(recovery).toContainText('full runtime and off-host recovery unverified');
        await recovery.scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`recovery-${width}.png`, output).pathname });
        const probe = page.locator('[data-checkout-probe]');
        await expect(probe).toContainText(/ · [\d,]+ ms$/);
        await expect(probe).not.toContainText('Unavailable');
        await probe.scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`checkout-probe-${width}.png`, output).pathname });
        const observations = page.locator('[data-checkout-history]');
        await expect(observations.getByRole('heading', { name: 'Checkout readiness history', exact: true })).toBeVisible();
        await expect(observations).toContainText('Monitoring began');
        await expect(observations).toContainText('sampled observations, not continuous uptime or payment outcomes');
        expect(await observations.locator('li').count()).toBeLessThanOrEqual(6);
        await observations.scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`readiness-history-${width}.png`, output).pathname });
        await expect(page.getByRole('link', { name: 'Original · captured November 9, 2026', exact: true })).toHaveAttribute('href', '/dashboard/instructions/original-2026-11-09.txt');
        await expect(page.getByRole('link', { name: 'Steer 1 · November 10, 2026', exact: true })).toHaveAttribute('href', '/dashboard/instructions/steer-1-2026-11-10.txt');
        expect(await page.locator('#instructions a').allTextContents()).toEqual([
          'Original · captured November 9, 2026', 'Steer 1 · November 10, 2026', 'Steer 2 · November 11, 2026',
        ]);
        const steer2 = page.getByRole('link', { name: 'Steer 2 · November 11, 2026', exact: true });
        await expect(steer2).toHaveAttribute('href', steer2Path);
        await steer2.scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`instructions-${width}.png`, output).pathname });
        const archiveResponse = page.waitForResponse(response => new URL(response.url()).pathname === steer2Path);
        await steer2.click();
        expect(await (await archiveResponse).text()).toBe(steer2Text);
        await expect(page.locator('body')).toContainText('PR Worktree Disk Hygiene');
        await page.goBack();
        await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('link', { name: 'Latest work', exact: true }).click();
        await page.waitForURL(url => url.hash === '#history');
        await expect(page.locator('#history').getByRole('link', { name: 'Read the full build history', exact: true })).toHaveAttribute('href', '/dashboard/history/');
      } else if (view === 'history') {
        await expect(page.locator('.cycle-entry')).toHaveCount(historyTitles.length);
        expect(await page.locator('.cycle-entry h3').allTextContents()).toEqual(historyTitles);
        await expect(page.locator('.cycle-entry').last()).toContainText('November 9');
        await expect(page.locator('table')).toHaveCount(0);
        await expect(page.locator('[data-activity-metrics]')).toHaveCount(0);
        await page.locator('.cycle-entry').first().scrollIntoViewIfNeeded();
      } else {
        await expect(page.locator('.cycle-entry')).toHaveCount(0);
        await expect(page.locator('table')).toHaveCount(3);
        const candidates = page.getByRole('table', { name: 'Framework candidates · release state is separate', exact: true });
        await expect(candidates.locator('tbody tr')).toHaveCount(18);
        const cardState = candidates.locator('tr').filter({ hasText: 'fix/product-card-state' });
        await expect(cardState).toContainText('no host change or repeated live save');
        await expect(cardState.getByRole('link', { name: 'PR #267', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/commerce/pull/267');
        const returnStartup = candidates.locator('tr').filter({ hasText: 'fix/checkout-return-initial-state' });
        await expect(returnStartup.getByRole('link', { name: 'PR #226', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/template-store/pull/226');
        await expect(returnStartup).toContainText('without changing payment, storage, retry or receipt logic');
        const chronology = candidates.locator('tr').filter({ hasText: 'fix/native-order-chronology' });
        await expect(chronology).toContainText('signed store plugin is unchanged');
        await expect(chronology.getByRole('link', { name: 'PR #266', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/commerce/pull/266');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/checkout-settings-layout' })).toContainText('not shared-deployed');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/checkout-settings-layout' }).getByRole('link', { name: 'PR #124', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/dinkuskit/pull/124');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/missing-item-weight' })).toContainText('substantive CI awaits maintainer approval');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/order-variant-labels' })).toContainText('signed store plugin is unchanged');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/product-control-readiness' })).toContainText('aggregate checks pass');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/checkout-contact-feedback' })).toContainText('queued with no jobs');
        await expect(page.locator('[data-activity-metrics]')).toHaveCount(0);
        await page.locator('#contributions').scrollIntoViewIfNeeded();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const secret of ['sk_test_', 'whsec_', 'github_pat_', 'emdash_enc_v1_', '/var/lib/', 'session_file']) await expect(page.locator('main')).not.toContainText(secret);
      await page.screenshot({ path: new URL(`${view}-${width}.png`, output).pathname });
      if (view !== 'overview') {
        await page.getByRole('navigation', { name: 'Return to the overview' }).getByRole('link').click();
        await page.waitForURL(url => /^\/dashboard\/?$/.test(url.pathname));
        await expect(page.locator('[data-dashboard-view]')).toHaveAttribute('data-dashboard-view', 'overview');
      }
    }
    expect(sizes.overview).toBeLessThan(sizes.history);
    expect(writes).toEqual([]);
    results.push({ width, javaScriptEnabled: false, views: 3, archiveEntries: historyTitles.length, candidateRows: 18, currentNavigation: true, noOverflow: true, privateFieldsAbsent: true, instructionVersions: 3, steer2ArchiveExact: true, boundedReadinessHistory: true, writes: 0, bytes: sizes });
    await context.close();
  }
  await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
