// Focused, read-only dashboard check on the live release or a local candidate.
import { chromium, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

if (!process.argv.includes('--check')) {
  console.log('No action. Use --check with optional --base=URL and --output=DIR.');
} else {
  const option = key => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
  const base = new URL(option('base') ?? 'https://backroadbum.com').origin;
  const output = option('output');
  if (output) await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, colorScheme, javaScriptEnabled: false, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      try {
        await context.route('**/*', route => {
          const req = route.request();
          return new URL(req.url()).origin === base && ['GET', 'HEAD'].includes(req.method()) ? route.continue() : route.abort();
        });
        const page = await context.newPage();
        const request = await page.goto(base + '/dashboard#history');
        expect(request.status()).toBe(200);
        expect(request.headers()['cache-control']).toBe('no-store');
        await page.evaluate(() => document.fonts.ready);
        const latest = page.locator('#history');
        const archive = latest.locator('details[data-dispatch-archive]');
        const summary = archive.locator(':scope > summary');
        const firstOlder = archive.locator(':scope > article').first();
        const historyLink = latest.getByRole('link', { name: 'Read the build history', exact: true });
        await expect(latest.locator(':scope > article')).toHaveCount(1);
        await expect(historyLink).toBeVisible();
        await expect(firstOlder).toBeHidden();
        await expect(summary).toHaveText('Earlier dispatches');
        const gap = await latest.evaluate(section => Math.round(document.getElementById('contributions').getBoundingClientRect().top - section.getBoundingClientRect().top));
        expect(gap).toBeLessThan(700);
        expect(await summary.evaluate(el => Math.min(el.offsetWidth, el.offsetHeight))).toBeGreaterThanOrEqual(44);

        await summary.press('Enter');
        await expect(summary).toBeFocused();
        await expect(firstOlder).toBeVisible();
        await expect(archive.locator('[data-journal-return-dispatch] a')).toHaveAttribute('href', '/field-note-wet-gear-reset');
        await expect(latest.getByRole('heading', { name: 'Latest work', level: 2 })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (output) await page.screenshot({ path: `${output}/archive-open-${width}-${colorScheme}.jpg`, type: 'jpeg' });
        const archivedDetail = archive.getByText('Previous dispatch · Protected sibling saves', { exact: true });
        await archivedDetail.press('Enter');
        const archivedBody = archive.locator('[data-native-contention-dispatch]');
        await expect(archivedBody).toBeVisible();
        await expect(archivedBody.getByRole('link', { name: 'Desktop refusal' })).toHaveAttribute('href', '/pr-proof/native-catalog-contention/stale-desktop.png');
        await archivedDetail.press('Enter');
        await expect(archivedBody).toBeHidden();
        await summary.press('Space');
        await expect(summary).toBeFocused();
        await expect(firstOlder).toBeHidden();

        await historyLink.press('Enter');
        await expect(page).toHaveURL(base + '/dashboard/history#history');
        await expect(page.getByRole('heading', { name: 'Cycle entries', exact: true })).toBeVisible();
        await expect(page.locator('details[data-dispatch-archive]')).toHaveCount(0);
        console.log(JSON.stringify({ width, colorScheme, scriptFree: true, closedGapToReviews: gap, archiveKeyboardRoundTrip: true, datedHistoryDirect: true }));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}
