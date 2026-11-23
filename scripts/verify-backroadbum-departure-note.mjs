// Read-only public manuscript/discovery check. No staff session or shopper writes.
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

const origin = 'https://backroadbum.com';
const source = JSON.parse(readFileSync(new URL('../seed/backroadbum-departure-note.json', import.meta.url), 'utf8'));
const out = new URL('../runs/backroadbum/departure-note/', import.meta.url);
mkdirSync(out, { recursive: true });
const full = block => block.text + (block.link ? block.link.text + block.after : '');
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, javaScriptEnabled, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], errors = [];
    await context.route('**/*', route => {
      if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
      writes.push(new URL(route.request().url()).pathname); return route.abort();
    });
    try {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      const fits = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal((await page.goto(origin + '/field-notes')).status(), 200);
      const notes = await page.locator('.brb-story-link').evaluateAll(links => links.map(a => a.getAttribute('href')));
      assert.equal(notes.filter(href => href === '/' + source.slug).length, 1);
      assert.ok(notes.length >= 8);
      await fits();
      const link = page.getByRole('link', { name: source.title, exact: true });
      await link.focus(); await page.keyboard.press('Enter');
      await expect(page).toHaveURL(origin + '/' + source.slug);
      await expect(page.locator('h1')).toHaveText(source.title);
      await expect(page.locator('.cms-page__body h2')).toHaveText(source.sections.filter(b => b.style === 'h2').map(full));
      await expect(page.locator('.cms-page__body ol > li')).toHaveText(source.sections.filter(b => b.listItem).map(full));
      await expect(page.locator('.cms-page__body p')).toHaveText(source.sections.filter(b => b.style === 'normal' && !b.listItem).map(full));
      for (const block of source.sections.filter(b => b.link)) await expect(page.locator('.cms-page__body').getByRole('link', { name: block.link.text, exact: true })).toHaveAttribute('href', block.link.href);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/' + source.slug);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', source.sections[0].text);
      const more = page.getByRole('navigation', { name: 'Read another note', exact: true });
      const ordered = [...notes].sort((a, b) => a.localeCompare(b));
      const index = ordered.indexOf('/' + source.slug);
      const onward = [ordered[(index + 1) % ordered.length], ordered[(index + 2) % ordered.length]];
      assert.deepEqual(await more.getByRole('link').evaluateAll(links => links.map(a => a.getAttribute('href'))), onward);
      await fits();
      if (javaScriptEnabled) {
        assert.equal(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches), colorScheme === 'dark');
        await page.evaluate(() => document.fonts.ready);
        await page.locator('.cms-page__body ol').scrollIntoViewIfNeeded();
        await page.screenshot({ path: new URL(`list-${width}-${colorScheme}.png`, out).pathname });
      }
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.cms-page__body ol')).toBeVisible();
      await expect(page.locator('.cms-page__body h2')).toHaveCount(4);
      for (const block of await page.locator('.cms-page__body :is(p,h2,li)').all()) await expect(block).toBeVisible();
      await expect(page.locator('.field-note__back')).toBeHidden();
      await expect(page.locator('.field-note-footer')).toHaveCount(1);
      await expect(page.locator('.field-note-footer')).toBeHidden();
      await expect(page.locator('.field-note__print-source')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      await page.locator('.field-note__back').click(); await expect(page).toHaveURL(`${origin}/field-notes#journal-${source.slug}`);
      await page.goto(origin + '/search?q=' + encodeURIComponent(source.searchTerm));
      const searchLink = page.getByRole('region', { name: 'Field notes & guides' }).getByRole('link', { name: source.title, exact: true });
      await expect(searchLink).toBeVisible(); await searchLink.click(); await expect(page.locator('h1')).toHaveText(source.title);
      await fits(); assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      results.push({ width, colorScheme, javaScriptEnabled, publishedNotes: notes.length, exactNativeContent: true, searchAndKeyboardDiscovery: true, onwardLinks: true, printMediaContent: true, noOverflow: true, writes: 0, errors: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const result = { checkedAt: new Date().toISOString(), results };
writeFileSync(new URL('verification.json', out), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
