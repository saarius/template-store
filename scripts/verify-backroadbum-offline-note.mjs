// Read-only native field-note proof. Optional argv[2] selects another authored source JSON.
// No admin or checkout capability; the default remains the offline-planning note.
import { chromium, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const customSource = process.argv[2];
const source = JSON.parse(await readFile(customSource ? resolve(customSource) : new URL('../seed/backroadbum-offline-note.json', import.meta.url), 'utf8'));
if (!/^field-note-[a-z0-9-]+$/.test(source.slug)) throw Error('Expected a field-note source');
const listKinds = [...new Set(source.sections.filter(block => block.listItem).map(block => block.listItem))];
if (listKinds.length !== 1 || !['number', 'bullet'].includes(listKinds[0])) throw Error('Expected one native list kind');
const listTag = listKinds[0] === 'bullet' ? 'ul' : 'ol';
const base = process.env.STORE_URL || 'https://backroadbum.com';
const output = new URL(`../runs/backroadbum/${customSource ? source.slug : 'offline-note'}/`, import.meta.url);
await mkdir(output, { recursive: true });
const fullText = block => block.text + (block.link ? block.link.text + block.after : '');
const headings = source.sections.filter(block => block.style === 'h2').map(fullText);
const items = source.sections.filter(block => block.listItem).map(fullText);
const paragraphs = source.sections.filter(block => block.style === 'normal' && !block.listItem).map(fullText);
const links = source.sections.filter(block => block.link).map(block => block.link);
const results = [];
const browser = await chromium.launch({ headless: true });
try {
  for (const [width, javaScriptEnabled] of [[1440, true], [390, true], [390, false]]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, javaScriptEnabled,
      reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
    try {
      const page = await context.newPage();
      const errors = [], writes = [], checkoutRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (request.method() !== 'GET') writes.push(request.method());
        if (/\/api\/checkout\//.test(request.url())) checkoutRequests.push(new URL(request.url()).pathname);
      });
      expect((await page.goto(base + '/field-notes')).status()).toBe(200);
      const discovery = page.locator('.brb-story-link').filter({ has: page.getByRole('heading', { name: source.title, exact: true }) });
      await expect(discovery).toHaveCount(1);
      await expect(discovery).toHaveAttribute('href', '/' + source.slug);
      await expect(discovery.locator('p')).toHaveText(source.sections[0].text);
      await discovery.click();
      await expect(page).toHaveURL(base + '/' + source.slug);
      await expect(page.locator('h1')).toHaveText(source.title);
      await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', base + '/' + source.slug);
      await expect(page.locator('meta[name=description]')).toHaveAttribute('content', source.sections[0].text);
      const body = page.locator('[data-cms-page-body]');
      await expect(body.locator('h2')).toHaveText(headings);
      await expect(body.locator(listTag)).toHaveCount(1);
      await expect(body.locator(`${listTag} > li`)).toHaveText(items);
      const itemGap = await body.locator(`${listTag} > li`).nth(1).evaluate(e => parseFloat(getComputedStyle(e).marginTop));
      expect(itemGap).toBeGreaterThanOrEqual(12);
      await expect(body.locator(':scope > p')).toHaveText(paragraphs);
      await expect(body.getByRole('link')).toHaveCount(links.length);
      for (const link of links) {
        const anchor = body.getByRole('link', { name: link.text, exact: true });
        await expect(anchor).toHaveAttribute('href', link.href);
        expect(await anchor.getAttribute('target')).not.toBe('_blank');
        const linkStyle = await anchor.evaluate(e => ({ color: getComputedStyle(e).color, decoration: getComputedStyle(e).textDecorationLine }));
        expect(linkStyle.color).toBe(await body.evaluate(e => getComputedStyle(e).color));
        expect(linkStyle.decoration).toContain('underline');
      }
      await expect(page.getByRole('navigation', { name: 'Read another note', exact: true }).getByRole('link')).toHaveCount(2);
      expect(await page.getByRole('navigation', { name: 'Read another note', exact: true }).locator(`a[href="/${source.slug}"]`).count()).toBe(0);
      await page.evaluate(async () => { await document.fonts.ready; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: new URL(`${width}-${javaScriptEnabled ? 'js' : 'nojs'}.png`, output).pathname, fullPage: true });
      // A native keyboard activation stays in this tab, preserving the reading path.
      for (const link of links) {
        const anchor = body.getByRole('link', { name: link.text, exact: true });
        await anchor.focus();
        const ring = await anchor.evaluate(e => ({ style: getComputedStyle(e).outlineStyle, width: parseFloat(getComputedStyle(e).outlineWidth) }));
        expect(ring.style).toBe('solid'); expect(ring.width).toBeGreaterThanOrEqual(3);
        await page.keyboard.press('Enter');
        await expect(page).toHaveURL(base + link.href);
        expect(context.pages()).toHaveLength(1);
        await page.goBack();
        await expect(page.locator('h1')).toHaveText(source.title);
      }
      await page.locator('.field-note__back').click();
      await expect(page).toHaveURL(base + '/field-notes');
      await page.goto(base + '/search?q=' + encodeURIComponent(source.searchTerm ?? 'signal'));
      await page.getByRole('region', { name: 'Field notes & guides', exact: true }).getByRole('link', { name: source.title, exact: true }).click();
      await expect(page).toHaveURL(base + '/' + source.slug);
      expect(writes).toEqual([]); expect(checkoutRequests).toEqual([]); expect(errors).toEqual([]);
      results.push({ width, javaScriptEnabled, sourceBlocks: source.sections.length, headings: headings.length,
        orderedItems: listKinds[0] === 'number' ? items.length : 0, bulletItems: listKinds[0] === 'bullet' ? items.length : 0,
        inlineLinks: links.length, sameTabKeyboardLinks: true, sourceTextExact: true,
        indexAndSearchDiscovery: true, separatedListItems: true, brandedUnderlinedLinks: true, focusRing: true,
        noOverflow: true, writes: 0, checkoutRequests: 0, browserErrors: 0 });
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
const evidence = { at: new Date().toISOString(), base, slug: source.slug, results };
await writeFile(new URL('verification.json', output), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
