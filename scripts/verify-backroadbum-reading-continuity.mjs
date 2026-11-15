// Read-only journal navigation proof; no account, catalog or checkout writes.
import { chromium, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

if (!process.argv.includes('--check')) {
  console.log('No action. --check verifies published journal links. --base=URL and --output=DIR select a candidate and evidence directory.');
} else {
  const option = (name, fallback) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
  const base = option('base', 'https://backroadbum.com').replace(/\/$/, '');
  const output = option('output', '/tmp/backroadbum-reading-continuity');
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const javaScriptEnabled of [true, false]) for (const colorScheme of ['light', 'dark']) for (const width of [390, 1440]) {
      const context = await browser.newContext({ javaScriptEnabled, colorScheme, viewport: { width, height: 1000 }, reducedMotion: 'reduce', userAgent: 'BackroadBum-SelfCheck/1.0' });
      context.setDefaultTimeout(15_000);
      context.setDefaultNavigationTimeout(30_000);
      console.log(`Reading ${width}px ${colorScheme}, JavaScript ${javaScriptEnabled ? 'on' : 'off'}`);
      const errors = [], writes = [], checkouts = [];
      await context.route('**/*', route => {
        const request = route.request();
        if (!['GET', 'HEAD'].includes(request.method())) { writes.push(new URL(request.url()).pathname); return route.abort(); }
        if (/\/api\/checkout\//.test(request.url())) { checkouts.push(new URL(request.url()).pathname); return route.abort(); }
        return route.continue();
      });
      try {
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        expect((await page.goto(`${base}/field-notes`)).status()).toBe(200);
        const notes = await page.locator('.brb-story-link').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href'), title: link.querySelector('h2').textContent })));
        expect(notes.length).toBeGreaterThan(2);
        const articles = [];
        for (const [index, note] of notes.entries()) {
          console.log(`Inspect ${note.href}`);
          expect((await page.goto(base + note.href)).status()).toBe(200);
          await expect(page.locator('h1')).toHaveText(note.title);
          const more = page.getByRole('navigation', { name: 'Read another note', exact: true });
          const expected = [notes[(index + 1) % notes.length], notes[(index + 2) % notes.length]];
          expect(await more.getByRole('link').evaluateAll(links => links.map(link => ({ href: link.getAttribute('href'), title: link.textContent })))).toEqual(expected);
          const body = await page.locator('[data-cms-page-body]').innerHTML();
          articles.push({ href: note.href, bodySHA256: createHash('sha256').update(body).digest('hex'), next: expected.map(item => item.href) });
          await expect(page.locator('.field-note-shop a')).toHaveAttribute('href', '/shop');
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
          if (index === 1 && javaScriptEnabled) {
            await more.scrollIntoViewIfNeeded();
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${output}/journal-${width}-${colorScheme}.png` });
          }
        }
        // Follow, rather than only inspect, the first offer through the whole journal.
        await page.goto(base + notes[0].href);
        const visited = [];
        for (const note of notes) {
          await expect(page.locator('h1')).toHaveText(note.title);
          visited.push(new URL(page.url()).pathname);
          const next = page.getByRole('navigation', { name: 'Read another note', exact: true }).getByRole('link').first();
          await next.focus();
          await expect(next).toBeFocused();
          console.log(`Follow ${new URL(page.url()).pathname}`);
          await next.press('Enter');
          await page.waitForURL(base + notes[visited.length % notes.length].href);
        }
        expect(visited).toEqual(notes.map(note => note.href));
        await expect(page.locator('h1')).toHaveText(notes[0].title);
        expect((await page.goto(`${base}/test-store`)).status()).toBe(200);
        await expect(page.locator('.field-note-footer')).toHaveCount(0);
        expect((await page.goto(`${base}/field-note-not-published`)).status()).toBe(404);
        await expect(page.locator('.field-note-footer')).toHaveCount(0);
        expect(errors).toEqual([]); expect(writes).toEqual([]); expect(checkouts).toEqual([]);
        results.push({ javaScriptEnabled, colorScheme, width, visited, articles, keyboardRoundTrip: true, browserErrors: errors.length, writes: writes.length, checkoutRequests: checkouts.length });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  const proof = { verifiedAt: new Date().toISOString(), base, results };
  await writeFile(`${output}/verification.json`, JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}
