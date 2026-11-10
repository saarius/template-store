// Read-only public editorial check. No admin session, cart writes or checkout requests.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/field-notes/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    const page = await context.newPage();
    const errors = [];
    const checkoutRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\/api\/checkout\//.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname); });
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await page.goto(base + '/field-notes')).status()).toBe(200);
    const notes = await page.locator('.brb-story-link').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href'), title: link.querySelector('h2').textContent })));
    expect(notes.length).toBeGreaterThanOrEqual(3);
    expect(notes.some(note => note.href === '/field-note-wet-gear-reset')).toBe(true);
    await page.locator('.brb-photo').evaluate(image => image.decode());
    await page.evaluate(() => document.fonts.ready);
    await fits();
    await page.screenshot({ path: new URL(`index-${width}.png`, output).pathname, fullPage: true });
    for (const note of notes) {
      expect(note.href).toMatch(/^\/field-note-[a-z0-9-]+$/);
      expect((await page.goto(base + note.href)).status()).toBe(200);
      await expect(page.locator('h1')).toHaveText(note.title);
      await expect(page.locator('.field-note__back')).toHaveAttribute('href', '/field-notes');
      const more = page.getByRole('navigation', { name: 'Read another note', exact: true });
      await expect(more.getByRole('link')).toHaveCount(Math.min(notes.length - 1, 2));
      await expect(more.locator(`a[href="${note.href}"]`)).toHaveCount(0);
      await expect(page.locator('.field-note-shop a')).toHaveAttribute('href', '/shop');
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/);
      await fits();
      if (note.href === '/field-note-wet-gear-reset') {
        await expect(page.locator('main')).toContainText('Unpack before the sofa');
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: new URL(`article-${width}.png`, output).pathname, fullPage: true });
        await page.locator('.field-note-shop a').click();
        await expect(page).toHaveURL(base + '/shop');
        await expect(page.locator('[data-commerce-product]')).toHaveCount(6);
      }
      await page.goto(base + note.href);
      await page.locator('.field-note__back').click();
      await expect(page).toHaveURL(base + '/field-notes');
    }
    expect((await page.goto(base + '/test-store')).status()).toBe(200);
    await expect(page.locator('.field-note-footer')).toHaveCount(0);
    expect((await page.goto(base + '/field-note-not-published')).status()).toBe(404);
    await expect(page.locator('[data-page-not-found]')).toBeVisible();
    await expect(page.locator('.field-note-footer')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(checkoutRequests).toEqual([]);
    results.push({ width, publishedNotes: notes.length, articlesRead: notes.length, backAndShopLinks: true, relatedReading: true, ordinaryPageUnchanged: true, unknownNote404: true, noOverflow: true, browserErrors: 0, checkoutRequests: 0 });
    await context.close();
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
