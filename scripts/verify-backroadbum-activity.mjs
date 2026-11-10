// Read-only reporting check. No session-file access, admin login or checkout calls.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STORE_URL || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/activity/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: false, userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const writes = [];
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
    expect((await page.goto(base + '/dashboard/')).status()).toBe(200);
    await page.getByRole('navigation', { name: 'Dashboard sections' }).getByRole('link', { name: 'Activity & costs', exact: true }).click();
    const section = page.locator('#costs');
    const metrics = section.locator('[data-activity-metrics]');
    await expect(metrics.locator('dt')).toHaveCount(15);
    await expect(metrics.locator('dd')).toHaveCount(15);
    await expect(section.locator('[data-successful-runs]')).toHaveText(/^[\d,]+$/);
    await expect(section.locator('[data-recorded-tokens]')).toHaveText(/^[\d,]+$/);
    await expect(section.locator('[data-api-equivalent]')).toHaveText(/^\$[\d,.]+ · (recorded request costs complete|partial cost coverage)$/);
    await expect(section).toContainText('a missing final response is not evidence that a cycle failed');
    await expect(section).toContainText('including repeated cached context');
    await expect(section).toContainText('Reasoning tokens · included in output');
    await expect(section).toContainText('Actual billed cost to date');
    await expect(section).toContainText('not an invoice');
    for (const privateText of ['/var/lib/', 'session_file', 'sk_test_', 'whsec_', 'github_pat_', 'rawStopReason']) {
      await expect(section).not.toContainText(privateText);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await section.screenshot({ path: new URL(`activity-${width}.png`, output).pathname });
    expect(writes).toEqual([]);
    results.push({ width, javaScriptEnabled: false, status: 200, semanticFacts: 15, recordedMetricsVisible: true, billingAndCoverageLabels: true, noPrivateFields: true, noOverflow: true, writes: 0 });
    await context.close();
  }
  await writeFile(new URL('verification.json', output), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
