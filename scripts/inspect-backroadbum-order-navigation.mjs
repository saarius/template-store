// Local operator only. No argument is inert; no output contains contact or authority.
import { orderNavigationRequestAllowed, readOrderNavigationArgs } from './lib/order-navigation-inspection.mjs';
let admin;
let stage = 'arguments';
try {
  const options = readOrderNavigationArgs(process.argv.slice(2));
  if (!options) {
    console.log('No check run. Use --check [--order=1010] for native TEST-order keyboard inspection.');
  } else {
    const { openAdmin } = await import('./backroadbum-admin.mjs');
    const { expect } = await import('@playwright/test');
    admin = await openAdmin();
    let blocked = 0;
    const actions = [];
    await admin.context.route('**/*', route => {
      const request = route.request();
      let body;
      try { body = request.postDataJSON(); } catch { /* GET and static bodies have no JSON. */ }
      if (!orderNavigationRequestAllowed(request.url(), request.method(), body)) {
        blocked++;
        return route.abort();
      }
      const input = body?.input ?? body;
      if (input?.type === 'block_action') actions.push(input.action_id.split(':')[0]);
      return route.continue();
    });
    stage = 'staff-sign-in';
    await admin.signIn();
    stage = 'orders-list';
    const page = admin.page;
    await page.goto('https://backroadbum.com/_emdash/admin/plugins/r_gshdrqaldna3r7sn/orders');
    const trigger = page.getByRole('button', { name: `Inspect #${options.order} (TEST)`, exact: true });
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    const checks = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const orderCount = await page.getByRole('button', { name: /^Inspect #\d+ \(TEST\)$/u }).count();
      await trigger.focus();
      const triggerSize = await trigger.evaluate(element => { const { width, height } = element.getBoundingClientRect(); return { width, height }; });
      // Keep only the trigger node, not any order/contact text or response body.
      await page.evaluate(() => { window.__orderInspectionTrigger = document.activeElement; });
      stage = 'inspect-' + width;
      await page.keyboard.press('Enter');
      const back = page.getByRole('button', { name: 'Back to orders', exact: true });
      await expect(back).toBeVisible();
      await expect.poll(() => back.evaluate(element => Boolean(element.closest('[aria-busy="true"]')))).toBe(false);
      const focus = await page.evaluate(() => ({
        triggerDetached: !window.__orderInspectionTrigger?.isConnected,
        bodyFocused: document.activeElement === document.body,
        activeTag: document.activeElement?.tagName,
        backFocused: document.activeElement?.textContent === 'Back to orders',
      }));
      let tabsToBack = focus.backFocused ? 0 : null;
      let nextTab = null;
      for (let i = 1; tabsToBack === null && i <= 80; i++) {
        await page.keyboard.press('Tab');
        const state = await back.evaluate(element => ({ backFocused: document.activeElement === element, tag: document.activeElement?.tagName }));
        if (i === 1) nextTab = state;
        if (state.backFocused) tabsToBack = i;
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      checks.push({ width, orderCount, triggerSize, focus, nextTab, tabsToBack, overflow });
      // Read-only navigation only. Never activate Complete, Reopen, Save or Ship.
      if (tabsToBack === null) await back.click();
      else await page.keyboard.press('Enter');
      await expect(trigger).toBeVisible();
    }
    if (blocked) throw new Error('Unexpected request refused');
    console.log(JSON.stringify({ schema: 'backroadbum.order-navigation-inspection/v1', order: options.order, checks, actions, blocked, limits: 'Native read interactions may reconcile existing Ship status; no save, checkout, label, mail or hosted write is admitted.' }, null, 2));
  }
} catch {
  console.error(`Order navigation inspection failed at ${stage}; no private response or browser state emitted.`);
  process.exitCode = 1;
} finally {
  await admin?.browser.close();
}
