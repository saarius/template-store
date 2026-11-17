#!/usr/bin/env node
/** Read-only native journal/fragment/keyboard/print check. No CMS or commerce writes. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';

const baselineMode = process.argv.includes('--baseline');
const base = process.env.BACKROADBUM_VERIFY_ORIGIN || 'https://backroadbum.com';
const out = resolve(process.env.BACKROADBUM_VERIFY_OUT || 'runs/backroadbum/note-sections');
const baselineFile = process.env.BACKROADBUM_VERIFY_BASELINE;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const articles = [], journeys = [];
const forbiddenWrites = [];
async function context(options = {}) {
  const ctx = await browser.newContext({ userAgent: 'BackroadBum-Operator-Check', ...options });
  await ctx.route('**/*', route => {
    if (!['GET', 'HEAD'].includes(route.request().method())) {
      forbiddenWrites.push(route.request().method()); return route.abort();
    }
    return route.continue();
  });
  return ctx;
}
try {
  const ctx = await context();
  try {
    const page = await ctx.newPage();
    await page.goto(`${base}/field-notes`);
    const paths = await page.locator('.field-index a.brb-story-link').evaluateAll(links => links.map(a => a.getAttribute('href')));
    assert(paths.length > 0);
    for (const path of paths) {
      await page.goto(base + path);
      const body = page.locator('[data-cms-page-body]');
      const facts = await body.evaluate(el => ({
        text: el.textContent.replace(/\s+/g, ' ').trim(),
        links: [...el.querySelectorAll('a')].map(a => ({ text: a.textContent, href: a.getAttribute('href') })),
        headings: [...el.querySelectorAll('h2')].map(h => h.textContent),
        lists: [...el.querySelectorAll('ol,ul')].map(l => ({ tag: l.tagName, text: l.textContent })),
      }));
      articles.push({ path, ...facts });
      if (!baselineMode && facts.headings.length > 1) {
        const sections = page.locator('[data-note-sections]');
        await expect(sections).toHaveCount(1);
        await sections.locator('summary').click();
        const links = sections.locator('nav a');
        assert.deepEqual(await links.allTextContents(), facts.headings);
        for (const link of await links.all()) {
          const href = await link.getAttribute('href');
          const target = body.locator(href);
          await expect(target).toHaveCount(1);
          assert.equal(await target.getAttribute('tabindex'), '-1');
        }
      }
    }
    for (const path of ['/test-store', '/shipping', '/returns', '/missing-note-sections-check']) {
      await page.goto(base + path);
      await expect(page.locator('[data-note-sections], [data-note-section]')).toHaveCount(0);
    }
  } finally { await ctx.close(); }

  if (baselineFile) assert.deepEqual(articles, JSON.parse(readFileSync(baselineFile, 'utf8')).articles);
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
    const ctx = await context({ viewport: { width, height: 1000 }, colorScheme, javaScriptEnabled });
    try {
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.name));
      await page.goto(base + '/field-note-the-two-minute-departure');
      if (!baselineMode) {
        const details = page.locator('[data-note-sections]');
        const summary = details.locator('summary');
        await summary.focus(); await page.keyboard.press('Enter');
        await expect(details).toHaveAttribute('open', '');
        const link = details.getByRole('link', { name: 'Do one small walk-round', exact: true });
        await link.focus(); await page.keyboard.press('Enter');
        const target = page.locator('#note-section-2');
        await expect(target).toBeFocused();
        await expect(target).toBeInViewport();
        assert.equal(new URL(page.url()).hash, '#note-section-2');
        // Native Back retains the disclosure and offers the same section again.
        await page.goBack();
        await expect(details).toHaveAttribute('open', '');
        await link.focus(); await page.keyboard.press('Enter');
        await page.reload();
        await expect(target).toBeInViewport();
        assert.equal(await target.textContent(), 'Do one small walk-round');
        await summary.focus(); await page.keyboard.press('Enter');
        if (javaScriptEnabled && ((width === 1440 && colorScheme === 'light') || (width === 390 && colorScheme === 'dark'))) {
          await details.screenshot({ path: `${out}/after-sections-${width}-${colorScheme}.png` });
        }
        await page.emulateMedia({ media: 'print' });
        await expect(details).toBeHidden();
        await expect(target).toBeVisible();
        await expect(page.locator('.field-note__print-source')).toBeVisible();
        await page.emulateMedia({ media: 'screen' });
      } else if (javaScriptEnabled && ((width === 1440 && colorScheme === 'light') || (width === 390 && colorScheme === 'dark'))) {
        await page.screenshot({ path: `${out}/before-${width}-${colorScheme}.png`, fullPage: true });
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.deepEqual(errors, []);
      journeys.push({ width, colorScheme, javaScriptEnabled, keyboardFragment: !baselineMode, nativeBack: !baselineMode, reload: !baselineMode, print: !baselineMode });
    } finally { await ctx.close(); }
  }
  assert.deepEqual(forbiddenWrites, []);
} finally { await browser.close(); }
writeFileSync(`${out}/result.json`, JSON.stringify({ checkedAt: new Date().toISOString(), baselineMode, articles, journeys, forbiddenWrites }, null, 2));
console.log(`${articles.length} native articles and ${journeys.length} read-only browser contexts pass${baselineMode ? ' (baseline)' : ''}.`);
