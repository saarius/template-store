// Browser-only input regression: all account writes are intercepted, no mail/session.
import { chromium, expect } from '@playwright/test';
import { commerceProfile } from '../src/features/commerce-profile/profiles.mjs';

export async function verifyAccountInput(base = process.env.BACKROADBUM_ORIGIN || 'https://backroadbum.com') {
  const browser = await chromium.launch(); const results = [];
  try {
    for (const width of [1440, 390]) for (const colorScheme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme, userAgent: 'BackroadBum-SelfCheck/1.0' });
      const page = await context.newPage(); let starts = 0, verifies = 0, unexpectedWrites = 0, submittedCode;
      await context.route('**/*', async route => {
        const request = route.request(), path = new URL(request.url()).pathname;
        if (['GET', 'HEAD'].includes(request.method())) return route.continue();
        const account = `/_emdash/api/plugins/${commerceProfile().runtimeId}/account/`;
        if (path === account + 'sign-in/start') {
          starts++;
          return route.fulfill({ json: { success: true, data: { ok: true, email: 'fixture@example.invalid', expiresAt: new Date(Date.now() + 600000).toISOString() } } });
        }
        if (path === account + 'sign-in/verify') {
          verifies++; submittedCode = request.postDataJSON().code;
          return route.fulfill({ status: 400, json: { success: true, data: { ok: false, error: { code: 'CODE_INVALID', message: 'Invalid verification code' } } } });
        }
        unexpectedWrites++; return route.abort();
      });
      await page.goto(base + '/account');
      await page.locator('[data-account-email]').fill('fixture@example.invalid');
      await page.locator('[data-account-start]').click();
      const code = page.locator('[data-account-code]'); await expect(code).toBeVisible();
      await code.fill('12'); await page.locator('[data-account-verify]').click();
      await expect(code).toHaveAttribute('aria-invalid', 'true'); expect(verifies).toBe(0);
      await code.fill(''); await code.focus();
      // insertText follows the same native maxlength limit as a clipboard insertion.
      await page.keyboard.insertText(' \t123456 ');
      await expect(code).toHaveValue(' \t123456 ');
      await expect(code).not.toHaveAttribute('aria-invalid', 'true');
      await page.locator('[data-account-verify]').click();
      await expect.poll(() => verifies).toBe(1); expect(submittedCode).toBe('123456');
      await expect(code).toHaveAttribute('aria-invalid', 'true');
      await expect(code).toHaveAttribute('aria-describedby', 'account-code-hint account-status');
      const box = await code.boundingBox(); expect(box.width).toBeLessThanOrEqual(162); expect(box.height).toBeGreaterThanOrEqual(48);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(starts).toBe(1); expect(unexpectedWrites).toBe(0);
      results.push({ width, colorScheme, syntheticOnly: true, mailSent: false, sessionCreated: false,
        pastePreservedAndTrimmed: true, fieldCorrectionAssociated: true, proportionalCodeInput: true, unexpectedWrites });
      await context.close();
    }
    return results;
  } finally { await browser.close(); }
}
if (import.meta.main) {
  if (process.argv.length === 2) console.log('No action. --check runs intercepted synthetic account input checks; no mail, shopper session or purchase.');
  else if (process.argv.length !== 3 || process.argv[2] !== '--check') { console.error('Use --check or no arguments. No action taken.'); process.exitCode = 1; }
  else { try { console.log(JSON.stringify(await verifyAccountInput(), null, 2)); } catch { console.error('Account input fixture failed; response details withheld.'); process.exitCode = 1; } }
}
