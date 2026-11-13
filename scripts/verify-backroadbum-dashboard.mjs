// Read-only dashboard navigation check. No admin, provider or shopper capabilities.
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../src/features/experiment-report/DashboardReport.astro', import.meta.url), 'utf8');
const historyTitles = [...source.matchAll(/<article class="cycle-entry"><h3>([^<]+)<\/h3>/g)].map(match => match[1]);
expect(historyTitles.length).toBeGreaterThan(0);
const steer2Path = '/dashboard/instructions/steer-2-2026-11-11.txt';
const steer2Text = await readFile(new URL('../public' + steer2Path, import.meta.url), 'utf8');
const steer3Path = '/dashboard/instructions/steer-3-2026-11-12.txt';
const steer3Text = await readFile(new URL('../public' + steer3Path, import.meta.url), 'utf8');
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
        await expect(page.locator('#history')).toContainText('Forty-four synthetic captures across eleven UI PRs are publicly hosted outside git');
        await expect(page.locator('#history')).toContainText('Checkout contact #223');
        await expect(page.locator('#history')).toContainText('synthetic checkout protocol and an admission flag');
        await expect(page.locator('#history')).toContainText('Cart return #220');
        await expect(page.locator('#history')).toContainText('trusted browser tab returns');
        await expect(page.locator('#history')).toContainText('same saved intent and focused quantity element');
        await expect(page.locator('#history')).toContainText('Saved-cart names #218');
        await expect(page.locator('#history')).toContainText('without snapshot interception');
        await expect(page.locator('#history')).toContainText('not a signed installation or payment-readiness proof');
        await expect(page.locator('#history')).toContainText('Variant cards #216');
        await expect(page.locator('#history')).toContainText('the isolated fixture does not prove payment readiness');
        await expect(page.locator('#history')).toContainText('additive contract still needs the maintainer decision');
        await expect(page.locator('.status-list > div').filter({ hasText: 'Catalog shipping weights' })).toContainText('not measured samples');
        await expect(page.locator('#emdash-bugs li')).toHaveCount(7);
        await expect(page.locator('#emdash-bugs')).toContainText('Reopen Shipping');
        await expect(page.locator('#emdash-bugs')).toContainText('initial activation was not a live shutdown test');
        await expect(page.locator('#history')).toContainText('Buying controls #225');
        await expect(page.locator('#history')).toContainText('Hosted checkout settings #124');
        await expect(page.locator('#history')).toContainText('normal November 12 stop at 22:24 UTC');
        await expect(page.locator('#history')).toContainText('do not prove continuous uptime or background-job drain');
        await expect(page.locator('#history')).toContainText('Eleven offline lifecycle checks pass');
        await expect(page.locator('#history')).toContainText('eight-second deadline');
        await expect(page.locator('#history')).toContainText('past deployment failures and unknown outage durations stay on record');
        await expect(page.locator('#contributions')).toContainText('a failing review-status check is not a failed test suite or release');
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
          'Original · captured November 9, 2026', 'Steer 1 · November 10, 2026', 'Steer 2 · November 11, 2026', 'Steer 3 · November 12, 2026',
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
        const steer3 = page.getByRole('link', { name: 'Steer 3 · November 12, 2026', exact: true });
        await expect(steer3).toHaveAttribute('href', steer3Path);
        const archive3Response = page.waitForResponse(response => new URL(response.url()).pathname === steer3Path);
        await steer3.click();
        expect(await (await archive3Response).text()).toBe(steer3Text);
        await expect(page.locator('body')).toContainText('Visual & Runtime Behavior Proof');
        await expect(page.locator('body')).toContainText('[owner account email redacted]');
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
        await expect(returnStartup).toContainText('captured disabled, blocked and delayed-script output');
        await expect(returnStartup).toContainText('proves neither provider recovery nor email delivery');
        const cartReturn = candidates.locator('tr').filter({ hasText: 'fix/cart-return-facts' });
        await expect(cartReturn).toContainText('four public Before/After cart captures');
        await expect(cartReturn).toContainText('no snapshot interception');
        await expect(cartReturn).toContainText('one worker, disclosed 15-second local timeout');
        await expect(cartReturn).toContainText('not a new signed installation, real BFCache restoration or payment-readiness proof');
        await expect(cartReturn).toContainText('same focused quantity element');
        const contact = candidates.locator('tr').filter({ hasText: 'fix/checkout-contact-feedback' });
        await expect(contact.getByRole('link', { name: 'PR #223', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/template-store/pull/223');
        await expect(contact).toContainText('only that control’s edits clear it');
        await expect(contact).toContainText('exact committed empty-email regression body fails on unchanged main');
        await expect(contact).toContainText('not provider readiness or a fresh signed installation');
        const controls = candidates.locator('tr').filter({ hasText: 'fix/product-control-readiness' });
        await expect(controls).toContainText('draft/on hold for the server-held-cart decision');
        await expect(controls).toContainText('four public Before/After desktop/phone captures');
        await expect(controls).toContainText('actual script-refusal diagnostics');
        await expect(controls).toContainText('not a new signed installation');
        const gallery = candidates.locator('tr').filter({ hasText: 'fix/gallery-no-script' });
        await expect(gallery).toContainText('four public Before/After desktop/phone screenshots');
        await expect(gallery).toContainText('browser Back and enhanced Space/Enter selection preserved');
        await expect(gallery).toContainText('not a new signed installation');
        const chronology = candidates.locator('tr').filter({ hasText: 'fix/native-order-chronology' });
        await expect(chronology).toContainText('signed store plugin is unchanged');
        await expect(chronology).toContainText('same installed-admin test fails on unchanged base');
        await expect(chronology).toContainText('proof item');
        await expect(chronology).toContainText('maintainer’s presentation-policy decision');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/invalid-cart-quantity' })).toContainText('cannot prove the proposed behavior');
        const memberSku = candidates.locator('tr').filter({ hasText: 'fix/public-variant-sku' });
        await expect(memberSku).toContainText('contract still needs a maintainer decision');
        await expect(memberSku).toContainText('captured anonymous compiled-Registry list/default/member HTTP output');
        const detailRows = candidates.locator('tr').filter({ hasText: 'fix/order-detail-rows' });
        await expect(detailRows).toContainText('four hosted Before/After desktop/phone screenshots');
        await expect(detailRows).toContainText('thirteen separate rows');
        await expect(chronology.getByRole('link', { name: 'PR #266', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/commerce/pull/266');
        const hostedSettings = candidates.locator('tr').filter({ hasText: 'fix/checkout-settings-layout' });
        await expect(hostedSettings).toContainText('not shared-deployed');
        await expect(hostedSettings).toContainText('four public Before/After desktop/phone form captures');
        await expect(hostedSettings).toContainText('native TEST saves, durable $5/$75 read-back');
        await expect(hostedSettings).toContainText('not a new signed installation or hosted settings submission');
        await expect(hostedSettings.getByRole('link', { name: 'PR #124', exact: true })).toHaveAttribute('href', 'https://github.com/dinkuskit/dinkuskit/pull/124');
        await expect(candidates.locator('tr').filter({ hasText: 'fix/missing-item-weight' })).toContainText('substantive CI awaits maintainer approval');
        const frozenChoices = candidates.locator('tr').filter({ hasText: 'fix/order-variant-labels' });
        await expect(frozenChoices).toContainText('signed store plugin is unchanged');
        await expect(frozenChoices).toContainText('four hosted Before/After desktop/phone screenshots');
        await expect(frozenChoices).toContainText('both Orders cases pass locally');
        await expect(frozenChoices).toContainText('b035d7b');
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
    results.push({ width, javaScriptEnabled: false, views: 3, archiveEntries: historyTitles.length, candidateRows: 18, currentNavigation: true, noOverflow: true, privateFieldsAbsent: true, instructionVersions: 4, steer2ArchiveExact: true, steer3ArchiveExact: true, boundedReadinessHistory: true, writes: 0, bytes: sizes });
    await context.close();
  }
  await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
