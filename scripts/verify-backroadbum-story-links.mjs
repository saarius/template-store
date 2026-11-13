// Read-only editorial link-name and keyboard regression. No admin or checkout traffic.
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.STORE_URL || 'https://backroadbum.com';
const output = new URL('../runs/backroadbum/story-links/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const width of [1440, 390]) {
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      const page = await context.newPage();
      const writes = [], checkoutRequests = [], errors = [];
      page.on('request', request => {
        if (request.method() !== 'GET') writes.push(request.method());
        if (/\/api\/checkout\//.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname);
      });
      page.on('pageerror', error => errors.push(error.message));
      const response = await page.goto(base + '/field-notes');
      expect(response.status()).toBe(200);
      await page.evaluate(async () => { await document.fonts.ready; await document.querySelector('.brb-photo').decode(); });
      const index = page.getByRole('region', { name: 'Published field notes', exact: true });
      const links = index.locator('.brb-story-link');
      const count = await links.count();
      expect(count).toBeGreaterThan(0);
      const ids = [];
      const notes = [];
      for (const link of await links.all()) {
        const title = (await link.locator('h2').textContent()).trim();
        const href = await link.getAttribute('href');
        await expect(link).toHaveAccessibleName(title, { timeout: 1000 });
        const headingId = await link.locator('h2').getAttribute('id');
        expect(headingId).toBeTruthy();
        expect(await link.getAttribute('aria-labelledby')).toBe(headingId);
        expect(await page.locator(`[id="${headingId}"]`).count()).toBe(1);
        ids.push(headingId);
        const excerpt = link.locator('p');
        if (await excerpt.count()) {
          await expect(excerpt).toBeVisible();
          await expect(excerpt).not.toHaveAttribute('aria-hidden', 'true');
          expect(await excerpt.textContent()).toMatch(/\S/);
        }
        const bounds = await link.boundingBox();
        expect(bounds.height).toBeGreaterThanOrEqual(48);
        expect(bounds.width).toBeGreaterThanOrEqual(48);
        notes.push({ title, href, accessibleName: title, excerptRetained: true });
      }
      expect(new Set(ids).size).toBe(count);
      // Tab from one whole-row link to the next, then Enter/Back through a real public note.
      await links.first().focus();
      for (let i = 0; i < count; i++) {
        await expect(links.nth(i)).toBeFocused();
        if (i < count - 1) await page.keyboard.press('Tab');
      }
      const last = notes.at(-1);
      expect(await links.last().evaluate(link => ({ style: getComputedStyle(link).outlineStyle, width: parseFloat(getComputedStyle(link).outlineWidth) }))).toEqual({ style: 'solid', width: 3 });
      await links.last().screenshot({ path: new URL(`focused-${width}-${javaScriptEnabled ? 'js' : 'nojs'}.png`, output).pathname });
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(base + last.href);
      await expect(page.locator('h1')).toHaveText(last.title);
      await page.goBack();
      await expect(page).toHaveURL(base + '/field-notes');
      await expect(page.getByRole('link', { name: last.title, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(writes).toEqual([]);
      expect(checkoutRequests).toEqual([]);
      expect(errors).toEqual([]);
      results.push({ width, javaScriptEnabled, notes, uniqueHeadingIds: true, titleOnlyNames: true, nativeKeyboardNavigation: true, focusRingPx: 3, noOverflow: true, writes: 0, checkoutRequests: 0, browserErrors: 0 });
      await context.close();
    }
  }
} finally { await browser.close(); }
const evidence = { verifiedAt: new Date().toISOString(), base, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
