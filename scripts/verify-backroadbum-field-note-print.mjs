// Read-only native article → PDF check. Requires Chromium and Poppler (pdfinfo/pdftotext).
// PDFs and captures stay in ignored runs/, never git or public proof by default.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const base = process.env.STORE_URL || 'https://backroadbum.com';
const canonicalOrigin = process.env.CANONICAL_ORIGIN || 'https://backroadbum.com';
const output = resolve(process.env.PRINT_OUTPUT || 'runs/backroadbum/field-note-print');
const normalize = text => text.replace(/\s+/g, ' ').trim();
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const colorScheme of ['light', 'dark']) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ colorScheme, javaScriptEnabled, viewport: { width: 390, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      const page = await context.newPage();
      const writes = [], checkoutRequests = [];
      page.on('request', request => {
        if (request.method() !== 'GET') writes.push(request.method());
        if (/\/api\/checkout\//.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname);
      });
      for (const slug of ['field-note-before-the-signal-drops', 'field-note-a-page-from-the-road']) {
        const response = await page.goto(`${base}/${slug}?print-source-check=omit-me`);
        expect(response.status()).toBe(200);
        await page.evaluate(() => document.fonts.ready);
        const body = page.locator('[data-cms-page-body]');
        const article = normalize(await body.innerText());
        const blocks = await body.locator('p,h2,li,blockquote').allTextContents();
        const title = await page.locator('h1').innerText();
        const source = page.locator('.field-note__print-source');
        await expect(source).toBeHidden();
        const screenColor = await body.evaluate(e => getComputedStyle(e).color);
        await page.emulateMedia({ media: 'print' });
        for (const selector of ['.store-demo-banner', '.store-header', '[data-store-footer]', '.field-note__back', '.field-note-footer']) {
          await expect(page.locator(selector)).toHaveCount(1);
          await expect(page.locator(selector)).toBeHidden();
        }
        await expect(source).toBeVisible();
        await expect(source.locator('span')).toHaveText(`${canonicalOrigin}/${slug}`);
        const geometry = await body.evaluate(e => {
          const s = getComputedStyle(e), p = getComputedStyle(e.querySelector('p'));
          return { fontPx: parseFloat(s.fontSize), color: p.color, paper: getComputedStyle(document.body).backgroundColor, headingPx: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize) };
        });
        expect(geometry.fontPx).toBeCloseTo(11 * 96 / 72, 1);
        expect(geometry.headingPx).toBe(32);
        expect(geometry.color).toBe('rgb(17, 17, 17)');
        expect(geometry.paper).toBe('rgb(255, 255, 255)');
        expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(255, 255, 255)');
        expect(normalize(await body.innerText())).toBe(article);
        const stem = `${slug}-${colorScheme}-${javaScriptEnabled ? 'js' : 'nojs'}`;
        const pdf = resolve(output, `${stem}.pdf`);
        await page.pdf({ path: pdf, format: 'A4', preferCSSPageSize: true, printBackground: true });
        const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
        const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
        const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
        expect(pages).toBeGreaterThan(0);
        expect(pages).toBeLessThanOrEqual(2);
        expect(normalize(text)).toContain(normalize(title));
        for (const block of blocks) expect(normalize(text)).toContain(normalize(block));
        expect(text).toContain(`${canonicalOrigin}/${slug}`);
        expect(text).toContain('DEMO / TEST STORE');
        expect(text).not.toContain('print-source-check');
        expect(text).not.toContain('Gear for the good part.');
        expect(text).not.toContain('Appearance');
        expect(text).not.toContain('Read another note');
        await writeFile(resolve(output, `${stem}.txt`), text);
        await page.emulateMedia({ media: 'screen' });
        await expect(source).toBeHidden();
        await expect(page.locator('.store-header')).toBeVisible();
        await expect(page.locator('.field-note-footer')).toBeVisible();
        expect(await body.evaluate(e => getComputedStyle(e).color)).toBe(screenColor);
        expect(normalize(await body.innerText())).toBe(article);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        results.push({ slug, colorScheme, javaScriptEnabled, pages, preservedBlocks: blocks.length, fullNativeText: true, sourceAndDemoContext: true, shellAndShoppingRemoved: true, screenRestored: true, ...geometry });
      }
      // A non-note CMS page must not acquire this page-specific print treatment.
      await page.goto(`${base}/test-store`);
      await page.emulateMedia({ media: 'print' });
      expect(await page.locator('body').getAttribute('data-field-note-page')).toBeNull();
      await expect(page.locator('.store-header')).toBeVisible();
      await expect(page.locator('.field-note__print-source')).toHaveCount(0);
      expect(writes).toEqual([]);
      expect(checkoutRequests).toEqual([]);
      await context.close();
    }
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results, browserWrites: 0, browserCheckoutRequests: 0, nonNotePrintUnchanged: true, limits: 'Chromium A4 PDF, not a physical-printer or other-browser certification. Native browser Print command; no custom print control.' };
await writeFile(resolve(output, 'verification.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
