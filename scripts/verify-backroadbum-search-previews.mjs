// Read-only real published-content proof; never prepares or starts checkout.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const before = process.argv.includes('--before');
const base = process.env.BACKROADBUM_VERIFY_BASE || 'https://backroadbum.com';
const output = process.env.BACKROADBUM_VERIFY_OUTPUT || new URL('../runs/backroadbum/search-previews/', import.meta.url).pathname;
await mkdir(output, { recursive: true });
const compact = raw => {
  const text = raw.replace(/\s+/gu, ' ').trim(), characters = Array.from(text);
  if (characters.length <= 240) return text;
  const prefix = characters.slice(0, 239).join(''), boundary = prefix.lastIndexOf(' ');
  return (boundary > 120 ? prefix.slice(0, boundary) : prefix).trimEnd() + '…';
};
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const javaScriptEnabled of [false, true]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled, userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      const page = await context.newPage(), errors = [], writes = [], checkout = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname);
        if (new URL(request.url()).pathname.startsWith('/api/checkout/')) checkout.push(new URL(request.url()).pathname);
      });
      expect((await page.goto(base + '/field-notes')).status()).toBe(200);
      const published = new Map(await page.locator('.brb-story-link').evaluateAll(links => links.map(link => [link.getAttribute('href'), link.querySelector('p')?.textContent || ''])));
      expect((await page.goto(base + '/search?q=mug')).status()).toBe(200);
      const region = page.getByRole('region', { name: 'Field notes & guides', exact: true });
      const rows = await region.locator('li').evaluateAll(items => items.map(li => ({
        title: li.querySelector('a').textContent, href: li.querySelector('a').getAttribute('href'), preview: li.querySelector('p')?.textContent || '', marks: li.querySelectorAll('mark').length,
      })));
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(published.has(row.href)).toBe(true);
        expect(row.preview).toBe(before ? '' : compact(published.get(row.href)));
        expect(row.marks).toBe(0); // Opening paragraphs, not invented match-location highlights.
      }
      await expect(page.getByRole('region', { name: 'Gear', exact: true }).getByRole('link', { name: 'Creekside Camp Mug', exact: true })).toHaveAttribute('href', '/products/creekside-camp-mug');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await region.getByRole('link', { name: rows[0].title, exact: true }).focus();
      expect(await region.getByRole('link', { name: rows[0].title, exact: true }).evaluate(a => getComputedStyle(a).outlineStyle)).not.toBe('none');
      if (!javaScriptEnabled) await page.screenshot({ path: `${output}/${before ? 'before' : 'after'}-${width}.png`, fullPage: true });
      await region.getByRole('link', { name: rows[0].title, exact: true }).press('Enter');
      await expect(page.locator('h1')).toHaveText(rows[0].title);
      await page.goto(base + '/search');
      await page.getByLabel('What are you looking for?', { exact: true }).fill('mug');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(page).toHaveURL(base + '/search?q=mug');
      await expect(page.getByRole('region', { name: 'Field notes & guides', exact: true }).locator('li p')).toHaveCount(before ? 0 : rows.length);
      await page.goto(base + '/search?q=zzzznonexistentgear');
      await expect(page.locator('[data-search-empty]')).toBeVisible();
      expect(errors).toEqual([]); expect(writes).toEqual([]); expect(checkout).toEqual([]);
      results.push({ width, javaScriptEnabled, rows, nativeSearch: true, keyboardDestination: true, emptyState: true, noOverflow: true, writes, checkout, errors });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const report = { checkedAt: new Date().toISOString(), mode: before ? 'before' : 'after', results };
await writeFile(`${output}/${report.mode}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
