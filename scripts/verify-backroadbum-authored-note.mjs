// Read-only native manuscript, search and optional gear-reading journeys.
// Source files are authorship checklists, never storefront content providers.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies a published manuscript; --source=backroadbum-layer-note.json selects a seed checklist. All browser writes are refused.');
  process.exit(0);
}
const name = process.argv.find(arg => arg.startsWith('--source='))?.slice(9) || 'backroadbum-layer-note.json';
assert.match(name, /^backroadbum-[a-z-]+-note\.json$/);
const source = JSON.parse(readFileSync(new URL('../seed/' + name, import.meta.url), 'utf8'));
assert.match(source.slug, /^field-note-[a-z0-9]+(?:-[a-z0-9]+)*$/);
const full = block => block.text + (block.link ? block.link.text + block.after : '');
const origin = 'https://backroadbum.com';
const out = new URL('../runs/backroadbum/authored-note/' + source.slug + '/', import.meta.url);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const cases = [];
try {
  for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) for (const javaScriptEnabled of [true, false]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, javaScriptEnabled,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const writes = [], errors = [];
    await context.route('**/*', route => {
      if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
      writes.push(new URL(route.request().url()).pathname); return route.abort();
    });
    try {
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.name));
      const fits = async () => {
        await page.waitForLoadState('load');
        await page.evaluate(() => document.fonts.ready);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `Horizontal overflow: ${new URL(page.url()).pathname}, ${width}px, ${colorScheme}, JS=${javaScriptEnabled}`);
      };
      assert.equal((await page.goto(origin + '/field-notes')).status(), 200);
      const notes = await page.locator('.brb-story-link').evaluateAll(links => links.map(a => a.getAttribute('href')));
      assert.equal(notes.filter(href => href === '/' + source.slug).length, 1);
      await page.getByRole('link', { name: source.title, exact: true }).focus(); await page.keyboard.press('Enter');
      await expect(page).toHaveURL(origin + '/' + source.slug);
      await expect(page.locator('h1')).toHaveText(source.title);
      const body = page.locator('.cms-page__body');
      await expect(body.locator('h2')).toHaveText(source.sections.filter(b => b.style === 'h2').map(full));
      await expect(body.locator('ol > li')).toHaveText(source.sections.filter(b => b.listItem === 'number').map(full));
      await expect(body.locator('p')).toHaveText(source.sections.filter(b => b.style === 'normal' && !b.listItem).map(full));
      for (const b of source.sections.filter(b => b.link)) await expect(body.getByRole('link', { name: b.link.text, exact: true })).toHaveAttribute('href', b.link.href);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', origin + '/' + source.slug);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', source.sections[0].text);
      // The index features the newest note first; article-to-article links
      // continue in stable slug order, independent of that featured slot.
      const sequence = notes.toSorted((a, b) => a.localeCompare(b));
      const index = sequence.indexOf('/' + source.slug);
      const onward = [sequence[(index + 1) % sequence.length], sequence[(index + 2) % sequence.length]];
      assert.deepEqual(await page.getByRole('navigation', { name: 'Read another note', exact: true }).getByRole('link').evaluateAll(links => links.map(a => a.getAttribute('href'))), onward);
      await fits(); await page.evaluate(() => document.fonts.ready);
      if (javaScriptEnabled) { await body.locator('ol').scrollIntoViewIfNeeded(); await page.screenshot({ path: new URL(`list-${width}-${colorScheme}.png`, out).pathname }); }
      await page.emulateMedia({ media: 'print' });
      for (const block of await body.locator('p,h2,li').all()) await expect(block).toBeVisible();
      await expect(page.locator('.field-note-footer')).toBeHidden();
      await expect(page.locator('.field-note__print-source')).toBeVisible();
      await page.emulateMedia({ media: 'screen' });
      await page.goto(origin + '/search?q=' + encodeURIComponent(source.searchTerm));
      const search = page.getByRole('region', { name: 'Field notes & guides' }).getByRole('link', { name: source.title, exact: true });
      await expect(search).toBeVisible(); await search.click(); await expect(page.locator('h1')).toHaveText(source.title);
      if (source.productPath) {
        await body.locator(`a[href="${source.productPath}"]`).click(); await expect(page).toHaveURL(origin + source.productPath);
        const price = await page.locator('[data-product-price]').textContent();
        const shelf = page.locator('[data-product-reading]'); const link = shelf.getByRole('link', { name: source.title, exact: true });
        await expect(link).toHaveAttribute('href', '/' + source.slug); assert((await link.boundingBox()).height >= 44);
        await link.focus(); await page.keyboard.press('Enter'); await expect(page.locator('h1')).toHaveText(source.title);
        await body.locator(`a[href="${source.productPath}"]`).click(); await expect(page.locator('[data-product-price]')).toHaveText(price);
        await fits();
      }
      if (source.collectionPath) {
        await page.goto(origin + source.collectionPath);
        const link = page.locator('[data-collection-reading]').getByRole('link', { name: source.title, exact: true });
        await expect(link).toHaveAttribute('href', '/' + source.slug); await link.focus(); await page.keyboard.press('Enter');
        await expect(page.locator('h1')).toHaveText(source.title); await fits();
      }
      assert.deepEqual(writes, []); assert.deepEqual(errors, []);
      cases.push({ width, colorScheme, javaScriptEnabled, notes: notes.length, exactNativeContent: true, keyboardAndSearch: true,
        onwardReading: true, printMedia: true, productAndCollection: !!source.productPath && !!source.collectionPath, noOverflow: true, writes: 0, errors: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const result = { checkedAt: new Date().toISOString(), slug: source.slug, cases };
writeFileSync(new URL('verification.json', out), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
