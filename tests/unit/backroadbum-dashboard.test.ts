import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Backroad Bum dashboard route boundaries', () => {
  it('keeps staged feed coverage and local catalog reads separate from live exports', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const dispatch = report.match(/<article[^>]+data-beta6-feed-dispatch>[\s\S]*?<\/article>/)?.[0];
    const history = report.match(/<article[^>]+data-beta6-feed-history>[\s\S]*?<\/article>/)?.[0];
    expect(dispatch).toContain('up from five in the live exports');
    expect(dispatch).toContain('href="/feeds/agent-catalog.json"');
    expect(history).toContain('kept a draft out of all three formats');
    expect(history).toContain('no shared deployment or enrollment');
  });
  it('distinguishes the held-cart issue and local Reviews proof from live adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    for (const marker of ['starter-payment-hold', 'review-mail-stop']) {
      expect(report).toContain(`data-${marker}-dispatch`);
      expect(report).toContain(`data-${marker}-history`);
      expect(reviews).toContain(`data-${marker}-ledger`);
    }
    const hold = reviews.match(/<tr data-starter-payment-hold-ledger>[\s\S]*?<\/tr>/)?.[0];
    expect(hold).toContain('template-store/issues/265');
    expect(hold).toContain('template-store/pull/266');
    expect(hold).toContain('Not deployed to Backroad Bum');
    expect(report).toContain('data-held-payment-receipt-dispatch');
    expect(report).toContain('data-held-payment-receipt-history');
    const merchant = report.match(/<article[^>]+data-field-journal-held-return-history>[\s\S]*?<\/article>/)?.[0];
    expect(merchant).toContain('commit/16e89e6');
    expect(merchant).toContain('simulated Payments');
    expect(merchant).toContain('The live checkout is unchanged.');
    expect(hold).toContain('Field Journal pairing');
    expect(report).toContain('Another browser could not open the receipt');
    expect(report).toContain('This used a local inbox; Reviews is not installed');
  });
  it('reports the distinction between voiding a queued label and one sent to Commerce', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const history = report.match(/<article[^>]+data-ship-label-void-history>[\s\S]*?<\/article>/)?.[0];
    expect(history).toContain('ship/pull/103');
    expect(history).toContain('until a replacement supplied new tracking');
    expect(history).toContain('the order could still complete with it');
    expect(history).toContain('no live order or label changed');
  });
  it('links the cart-return fix and proof without claiming a live cutover', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    const history = report.match(/<article[^>]+data-cart-return-pr-history>[\s\S]*?<\/article>/)?.[0];
    const ledger = reviews.match(/<tr data-cart-return-pr-ledger>[\s\S]*?<\/tr>/)?.[0];
    expect(history).toContain('template-store/pull/267');
    expect(history).toContain('without replacing unsaved edits');
    expect(ledger).toContain('template-store/issues/249');
    for (const shot of ['before-390.png', 'after-390.png']) expect(ledger).toContain(`/pr-proof/template-store-cart-return/${shot}`);
    expect(ledger).toContain('Not deployed to Backroad Bum.');
  });
  it('reports saving quantities and the payment hold without claiming a live cart upgrade', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    const dispatch = report.match(/<article[^>]+data-cart-save-checkout-dispatch>[\s\S]*?<\/article>/)?.[0];
    const history = report.match(/<article[^>]+data-cart-held-payment-history>[\s\S]*?<\/article>/)?.[0];
    const ledger = reviews.match(/<tr data-cart-save-checkout-ledger>[\s\S]*?<\/tr>/)?.[0];
    expect(dispatch).toContain('Only this report is live.');
    expect(dispatch).toContain('$78 subtotal');
    expect(history).toContain('until Commerce confirms it is unpaid');
    expect(report).toContain('data-cart-save-checkout-history');
    expect(ledger).toContain('template-store/pull/264');
    expect(ledger).toContain('Not on the live cart.');
  });
  it('distinguishes isolated Accounts relay proof from a live rollout', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const dispatch = report.match(/<article[^>]+data-accounts-relay-dispatch>[\s\S]*?<\/article>/)?.[0];
    const history = report.match(/<article[^>]+data-accounts-relay-history>[\s\S]*?<\/article>/)?.[0];
    expect(dispatch).toContain('from a disposable store');
    expect(dispatch).toContain('checkout address prefill still need testing');
    expect(dispatch).toContain('live account and checkout are unchanged');
    expect(history).toContain('one code to the verified test inbox');
    expect(history).toContain('no plugin was installed on the live store');
  });
  it('separates the staged printed lookup and retained receipt from the live store', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    for (const marker of ['archived-orders-beta6', 'field-journal-beta6', 'retained-beta6', 'printed-test-lookup', 'beta6-outbox']) {
      expect(report).toContain(`data-${marker}-history`);
    }
    expect(report).toContain('data-retained-beta6-dispatch');
    expect(report).toContain('/pr-proof/retained-beta6/receipt-390-dark.png');
    expect(report).toContain('Neither change is live.');
    const staging = report.match(/<div data-server-cart-staging>[\s\S]*?<\/div>/)?.[0];
    expect(staging).toContain('now pairs with Commerce beta.6');
    expect(staging).toContain('In a private copy, both original saved receipts recovered');
    expect(staging).toContain('found all ten earlier test orders');
    expect(staging).toContain('commerce/pull/286');
    expect(staging).toContain('The live cart still uses signed Commerce 0.8.0.');
  });
  it('reports the merged cart lock and focus fix and isolated reminders-off check', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    for (const marker of ['cart-focus-followup', 'cart-reminder-off']) {
      expect(report).toContain(`data-${marker}-dispatch`);
      expect(report).toContain(`data-${marker}-history`);
    }
    expect(report).toContain('not on Backroad Bum’s live cart');
    expect(report).toContain('the test inbox stayed empty');
    expect(reviews).toContain('#243 merged November 22 at af90a48');
    const focus = reviews.match(/<tr data-cart-focus-followup-ledger>[\s\S]*?<\/tr>/)?.[0];
    expect(focus).toContain('Merged November 23 · 8a5341c');
    expect(focus).toContain('Adopted in Field Journal staging only.');
    expect(focus).toContain('fork 0df23f1');
    expect(focus).toContain('/pr-proof/template-pr246-dawn-focus/after-mobile.png');
  });
  it('reports the Reviews rehearsal and Registry handoff separately from live adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    const issue = 'https://github.com/dinkuskit/courier/issues/3';
    expect(report).toContain('data-reviews-rollout-dispatch');
    expect(report).toContain('data-courier-registry-history');
    expect(report).toContain('data-storefront-reviews-history');
    expect(report).toContain('the product page, not the agent feed');
    expect(report).toContain('Reviews are not installed on Backroad Bum');
    expect(report).toContain(issue);
    const row = reviews.match(/<tr data-courier-registry-ledger>[\s\S]*?<\/tr>/)?.[0];
    expect(row).toContain(issue);
    expect(row).toContain('Courier #3 is open');
    expect(row).toContain('merged the Cloudflare timer, not a fix');
    expect(row).toContain('No Reviews rollout on Backroad Bum');
  });
  it('separates the disposable upgrade rehearsal from the live storefront', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-emdash-bridge-dispatch');
    expect(report).toContain('data-emdash-bridge-history');
    expect(report).toContain('The live store remains on Commerce 0.8.0');
    expect(report).toContain('with a test mail sink');
    expect(report).toContain('data-beta5-cart-mail-dispatch');
    expect(report).toContain('data-beta5-cart-mail-history');
    expect(report).toContain('No external email was sent');
    expect(reviews).toContain('template-store/pull/255');
    expect(reviews).toContain('template-store/pull/253');
  });
  it('records the maintainer-ordered review refresh and dependent waits without a live upgrade claim', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-review-refresh-dispatch');
    expect(report).toContain('data-review-refresh-history');
    const ledger = reviews.match(/<table id="housekeeping-ledger"[\s\S]*?<\/table>/)?.[0];
    expect(ledger).toBeDefined();
    for (const fact of ['8743e59', 'a64d546', '45064358268/attempts/2', '64352db', '45071045667',
      'Server-rendered shopper accounts', 'order lookup is not an account replacement']) expect(ledger).toContain(fact);
    expect(report).toContain('data-emdash15-refresh-dispatch');
    expect(report).toContain('data-emdash15-seed-history');
    expect(report).toContain('The agent cycle timed out during the remaining #248 proof capture');
    expect(report).toContain('not deployed to Backroad Bum');
    expect(report).toContain('/pr-proof/template-pr241-refresh/after-mobile.png');
    expect(report).toContain('no new purchase or live cart upgrade');
  });
  it('reconciles the manual housekeeping queue without claiming signed adoption or superseded port repair', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-housekeeping-dispatch');
    expect(report).toContain('data-housekeeping-history');
    expect(report.match(/class="cycle-entry"/g)?.length).toBeGreaterThanOrEqual(242);
    expect(report).toContain('recurring cycles remain paused');
    expect(reviews).toContain('data-housekeeping-ledger');
    expect(reviews).toContain('data-historical-review-context');
    for (const link of ['commerce/pull/280', 'commerce/pull/282', 'dinkuskit/pull/130', 'payments/issues/118',
      'template-store/pull/244', 'template-store/pull/248', 'template-store/pull/246', 'template-store/pull/243',
      'template-store/pull/241', 'template-store/pull/235', 'template-store/pull/237', 'template-store/pull/239',
      'dinkuskit/pull/133', 'dinkuskit/issues/132', 'template-store/pull/240']) {
      expect(reviews).toContain('https://github.com/dinkuskit/' + link);
    }
    for (const fact of ['f03d136', 'Maintainers closed these on November 22', 'The maintainer chose the already-merged #136',
      'OS-assigned ports', 'Stage B and TEST1011 stay gated', 'Live signed feeds still have five rows']) expect(reviews).toContain(fact);
  });

  it('archives Steer 7 exactly while making its precedence over the old push trigger clear', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const archive = readFileSync('public/dashboard/instructions/steer-7-2026-11-20.txt', 'utf8');
    expect(source).toContain('Steer 7 arrived November 20');
    expect(source).toContain('replace Steer 3');
    expect(archive).toContain('Owner Steer 7 — November 20, 2026');
    expect(archive).toContain('Every push to a PR starts a ClawSweeper review by itself');
    expect(archive).toContain('Post it **once per commit**');
    expect(archive).toContain('**never** while a review is queued or running');
  });
  it('records the cart lock as upstream proof rather than a live change', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-cart-lock-dispatch');
    expect(report).toContain('data-cart-lock-history');
    expect(report).toContain('A second submit is ignored, not queued');
    expect(report).toContain('not a live cart change');
    expect(report).toContain('data-cart-agent-refresh-dispatch');
    expect(report).toContain('data-cart-agent-refresh-history');
    expect(report).toContain('/pr-proof/template-pr243-webmcp/after-mobile.png');
    expect(report).toContain('data-courier-review-fixture-history');
    expect(reviews).toContain('#243 at 64352db');
  });
  it('links the two November 22 instruction archives in order without claiming plugin adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const eighth = 'dashboard/instructions/steer-8-2026-11-22.txt';
    const ninth = 'dashboard/instructions/steer-9-2026-11-22.txt';
    expect(report).toContain('/' + eighth);
    expect(report.indexOf('/' + ninth)).toBeGreaterThan(report.indexOf('/' + eighth));
    expect(report).toContain('Neither is installed here');
    expect(readFileSync('public/' + eighth, 'utf8')).toContain('Runtime Upgraded (`Pi v1.6.0`');
    expect(readFileSync('public/' + ninth, 'utf8')).toContain('Expand DinkusKit Allowlist: `dinkuskit/accounts` & `dinkuskit/reviews`');
  });
  it('separates cross-tab staging evidence and reload recovery from a shipped repair', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-cart-tab-return-dispatch');
    expect(report).toContain('data-cart-tab-return-history');
    expect(reviews).toContain('data-cart-tab-return-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('https://github.com/dinkuskit/template-store/issues/249');
      expect(source).toContain('/pr-proof/server-cart-tab-return/stale-390.png');
      expect(source).toContain('not a');
    }
    expect(report).toContain('workaround, not a repair');
    expect(report).toContain('only this report ships on stable Commerce 0.8.0');
    expect(reviews).toContain('not a whole unchanged generic starter');
    expect(reviews).toContain('no runtime repair, live upgrade or new purchase');
  });
  it('bounds native sibling-form contention to refused writes and disposable prices', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    const runbook = readFileSync('ops/backroadbum/catalog-editing.md', 'utf8');
    expect(report).toContain('data-native-contention-dispatch');
    expect(report).toContain('data-native-contention-history');
    expect(reviews).toContain('data-native-contention-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('/pr-proof/native-catalog-contention/stale-phone.png');
      expect(source).toContain('/pr-proof/native-catalog-contention/cart-390.png');
      expect(source).toContain('No new framework defect');
    }
    expect(report).toContain('$204→$188→$182→$204');
    expect(report).toContain('HTTP200 alone is not a successful Save');
    expect(reviews).toContain('not a live promotion, signed upgrade');
    expect(runbook).toContain('same stale form remains refused');
    expect(runbook).toContain('not an authoritative Regular/Sale pair');
    expect(runbook).toContain('The first incomplete fixture was discarded');
  });
  it('bounds the accepted native lifecycle rehearsal to a fresh public-only beta fixture', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-native-lifecycle-dispatch');
    expect(report).toContain('data-native-lifecycle-history');
    expect(reviews).toContain('data-native-lifecycle-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('/pr-proof/native-cart-lifecycle/unavailable-390.png');
      expect(source).toContain('/pr-proof/native-cart-lifecycle/republished-390.png');
      expect(source).toContain('native initial publication');
      expect(source).toContain('revision pointers');
    }
    expect(report).toContain('same desktop and phone carts');
    expect(report).toContain('not an original-revision clone');
    expect(report).toContain('or checkout POST occurs');
    expect(reviews).toContain('https://github.com/dinkuskit/commerce/pull/277');
    expect(reviews).toContain('no new upstream request, live catalog edit or hosted purchase');
  });
  it('distinguishes restored merchant cart navigation from a live or generic runtime change', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-native-cart-links-dispatch');
    expect(report).toContain('data-native-cart-links-history');
    expect(reviews).toContain('data-native-cart-links-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('d394981');
      expect(source).toContain('/pr-proof/native-cart-links/after-phone.png');
      expect(source).toContain('full 560-file typecheck');
    }
    expect(report).toContain('without hiding Commerce facts');
    expect(report).toContain('not the future cart runtime or a signed upgrade');
    expect(reviews).toContain('not a generic upstream regression or live runtime change');
    expect(reviews).toContain('no duplicate review trigger or new upstream request');
  });
  it('bounds native size saves to temporary fixture prices and retained member identities', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-native-variant-cart-dispatch');
    expect(report).toContain('data-native-variant-cart-history');
    expect(reviews).toContain('data-native-variant-cart-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('M×2 + XL×1');
      expect(source).toContain('/pr-proof/native-variant-cart/staged-xl-admin.png');
      expect(source).toContain('/pr-proof/native-variant-cart/staged-sizes-cart.png');
      expect(source).toContain('original');
    }
    expect(report).toContain('$204→$196→$204');
    expect(report).toContain('Agent-feed reads match the XL sale');
    expect(report).toContain('signed same-ID upgrade and hosted payment remain separate');
    expect(reviews).toContain('not a live promotion');
    expect(reviews).toContain('no new defect, upstream request');
  });
  it('separates native price/cart staging and manifest fallout from live promotions or CMS repairs', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    const bugs = readFileSync('public/dashboard/emdash-bugs.txt', 'utf8');
    expect(report).toContain('data-native-price-cart-dispatch');
    expect(report).toContain('data-native-price-cart-history');
    expect(reviews).toContain('data-native-price-cart-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('57f0ec0');
      expect(source).toContain('/pr-proof/native-price-cart/staged-cart-phone.png');
    }
    expect(reviews).toContain('not a live promotion');
    expect(report).toContain('only reporting ships here, not new live prices');
    expect(report).toContain('full merchant regression, public Regular/Sale projection');
    expect(bugs).toContain('## 13. Missing block schemas');
    expect(bugs).toContain('our qualification copier omitted schema dependencies');
    expect(bugs).toContain('No EmDash issue, PR or comment was opened');
  });
  it('bounds journal-to-cart preparation to disposable installed-beta journeys', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-reading-cart-sync-dispatch');
    expect(report).toContain('data-reading-cart-sync-history');
    expect(reviews).toContain('data-reading-cart-sync-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('7a3ce50');
      expect(source).toContain('80 focused units');
      expect(source).toContain('/pr-proof/server-cart-reading/phone-enhanced.png');
      expect(source).toContain('without Payments');
    }
    expect(report).toContain('not a live cart upgrade or hosted purchase');
    expect(report).toContain('authoritative public Regular/Sale projection');
    expect(reviews).toContain('Twelve authored PRs remain open');
  });
  it('reports native shade reading without invented cap performance or commerce changes', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-shade-note-dispatch');
    expect(report).toContain('data-shade-note-history');
    expect(report).toContain('/field-note-a-shady-place-to-stop');
    expect(report).toContain('Ten EmDash field notes');
    expect(report).toContain('without inventing a protection rating or measured fit range');
    expect(report).toContain('all thirteen earlier Pages, catalog and ten Orders remain unchanged');
    expect(report).toContain('/pr-proof/shade-note/phone-dark.png');
  });
  it('limits published membership qualification to installed public routes, not merchant cutover', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-published-membership-dispatch');
    expect(report).toContain('data-published-membership-history');
    expect(report).toContain('3b8ffcc');
    expect(report).toContain('34 public routes');
    expect(report).toContain('seven products, two collections and all nine notes');
    expect(report).toContain('earlier sampled storefront checks did not cover that navigation');
    expect(report).toContain('same-ID stable upgrade, complete merchant admin/browser matrix and hosted purchase remain separate');
    expect(reviews).toContain('44052916802');
    expect(reviews).toContain('64 desktop and 63 phone browser tests');
    expect(reviews).toContain('ClawSweeper review is requested');
  });
  it('reports the cold-option proposal without implying live server-cart adoption or full local matrix', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-initial-stock-pr-dispatch');
    expect(report).toContain('data-initial-stock-pr-history');
    expect(reviews).toContain('data-initial-stock-pr-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('https://github.com/dinkuskit/template-store/pull/248');
      expect(source).toContain('/pr-proof/template-initial-stock/after-desktop-light.png');
      expect(source).toContain('567 units, 101 workflows');
      expect(source).toContain('four targeted browser tests');
      expect(source).toContain('eight painted views');
      expect(source).toContain('unchanged main');
      expect(source).toContain('Commerce 0.8.0');
    }
    expect(report).toContain('only this report ships on stable Commerce 0.8.0');
    expect(reviews).toContain('not a signed installation or merchant theme');
  });
  it('separates installed-beta variant preparation from the live cart and full-matrix gates', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-variant-startup-dispatch');
    expect(report).toContain('data-variant-startup-history');
    expect(reviews).toContain('data-variant-startup-review');
    for (const source of [report, reviews]) {
      expect(source).toContain('https://github.com/dinkuskit/template-store/issues/247');
      expect(source).toContain('/pr-proof/server-cart-initial-sellability/after-390-dark.png');
    }
    expect(report).toContain('not a live Commerce upgrade');
    expect(report).toContain('1,271 units, 13 rendered cases and 120 workflows');
    expect(reviews).toContain('full local browser matrix and a generic PR remain separate');
  });
  it('reports the submitted cart-focus proposal without claiming full local matrix or live adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-cart-focus-pr-dispatch');
    expect(report).toContain('data-cart-focus-pr-history');
    for (const source of [report, reviews]) {
      expect(source).toContain('https://github.com/dinkuskit/template-store/pull/246');
      expect(source).toContain('575 units, 101 workflows');
      expect(source).toContain('unchanged main');
      expect(source).toContain('Registry-site builds');
      expect(source).toContain('64 desktop and 63 phone browser tests');
      expect(source).toContain('44026879796');
    }
    expect(report).toContain('not a stable Commerce upgrade or completed merchant regression');
    expect(reviews).toContain('No live cart cutover is claimed');
  });
  it('separates generic cart focus proof from synthetic projections and live adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-cart-focus-edges-dispatch');
    expect(report).toContain('data-cart-focus-edges-history');
    expect(report).toContain('synthetic projections separately check frozen');
    expect(report).toContain('not a submitted PR, completed full regression or Commerce upgrade');
    expect(reviews).toContain('data-cart-focus-edges-review');
    expect(reviews).toContain('source-built pinned-beta1');
    expect(reviews).toContain('not renewed complete merchant regression or hosted frozen-payment proof');
    expect(reviews).toContain('e2cc307');
    expect(reviews).toContain('254b6e4');
    for (const source of [report, reviews]) expect(source).toContain('/pr-proof/template-cart-focus/after-desktop-light.png');
  });
  it('reports untouched delivery as a merchant-client correction with intercepted transport', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-empty-delivery-dispatch');
    expect(report).toContain('data-empty-delivery-history');
    expect(report).toContain('Previous dispatch · Feed member landings');
    expect(report).toContain('synthetic capability transport and every real start blocked');
    expect(report).toContain('not the prepared server-cart flow or a signed-plugin contract');
    expect(report).toContain('/pr-proof/empty-delivery/before-390.png');
    expect(report).toContain('/pr-proof/empty-delivery/after-390-dark.png');
  });
  it('bounds current preparation regression proof to its exact off-live source', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-prep-refresh-history');
    expect(report).toContain('data-prep-refresh');
    for (const source of [report, reviews]) {
      expect(source).toContain('9f9ee81');
      expect(source).toContain('1,255 units, 120 workflows with two optional skips');
      expect(source).toContain('551-file typecheck');
      expect(source).toContain('complete browser matrix');
    }
    expect(report).toContain('Cloudflare site command correctly refuses missing deployment configuration');
    expect(report).toContain('24 live public pages');
    expect(reviews).toContain('No new upstream submission or duplicate review trigger was sent');
  });
  it('separates deployed feed URL production from the proposed consumer and signed rows', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-feed-landings-dispatch');
    expect(report).toContain('data-feed-landings-history');
    expect(report).toContain('Previous dispatch · Product reading');
    expect(report).toContain('signed XML/CSV still have five rows');
    expect(report).toContain('a released consumer remains necessary');
    expect(reviews).toContain('data-feed-landings-review');
    expect(reviews).toContain('fix/feed-variant-urls');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/pull/244');
    expect(reviews).toContain('not the generic variant query');
  });
  it('reports native product reading without inventing recommendations or a release', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-product-reading-dispatch');
    expect(report).toContain('data-product-reading-history');
    expect(report).toContain('Previous dispatch · Current archive recovery');
    expect(report).toContain('/products/county-line-field-book#product-reading-title');
    expect(report).toContain('published notes’ own product references');
    expect(report).toContain('Products without a matching note gain no reading shelf');
  });
  it('reports current local data recovery without claiming new-host or hosted restoration', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-current-recovery');
    expect(report).toContain('data-current-recovery-history');
    expect(report).toContain('Previous dispatch · Product option search');
    expect(report).toContain('eight published Field Notes rendering');
    expect(report).toContain('ten ready-media hashes offline');
    expect(report).toContain('all scoped business, plugin-storage and media rows remain unchanged');
    expect(report).toContain('not a new-host restore, admin sign-in, TLS recovery or hosted-payment qualification');
  });
  it('reports option discovery as a merchant fallback, not a plugin release or new authority', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-option-search');
    expect(report).toContain('data-option-search-history');
    expect(report).toContain('Previous dispatch · The two-minute departure');
    expect(report).toContain('When the native content index has no matches');
    expect(report).toContain('sold-out option');
    expect(report).toContain('no SKU, fuzzy-search or new price authority');
    expect(report).toContain('/pr-proof/search-options/after-390-dark.png');
    expect(report).toContain('this is merchant search, not a new plugin release');
  });
  it('reports native editorial depth separately from commerce qualification', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-departure-note');
    expect(report).toContain('data-departure-note-history');
    expect(report).toContain('Previous dispatch · Prepared cart regressions');
    expect(report).toContain('Ten EmDash field notes');
    expect(report).toContain('draft stayed off the public route, journal and search');
    expect(report).toContain('not a plugin upgrade or another checkout qualification');
    expect(report).toContain('all eleven earlier CMS page rows, catalog and ten Orders remain unchanged');
  });
  it('separates the completed unit/workflow inventory from browser and upgrade qualifications', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-cart-regression');
    expect(report).toContain('data-cart-regression-history');
    expect(report).toContain('Previous dispatch · Native checkout coverage');
    expect(report).toContain('all 1,235 unit tests, 120 workflow tests and ten rendered-component checks');
    expect(report).toContain('not the complete browser matrix, signed upgrade or hosted purchase');
    expect(reviews).toContain('data-cart-regression-review');
    expect(reviews).toContain('two optional skips');
    expect(reviews).toContain('pinned Node24.22.0');
    expect(reviews).toContain('no new source or review request was sent upstream');
  });
  it('labels native component tests as off-live synthetic coverage, not another runtime journey', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-native-presentation');
    expect(report).toContain('data-native-presentation-history');
    expect(report).toContain('Previous dispatch · Queued changes in Field Journal');
    expect(report).toContain('the original components are restored unchanged');
    expect(report).toContain('only reporting ships on stable Commerce 0.8.0');
    expect(reviews).toContain('data-native-presentation-review');
    expect(reviews).toContain('off-live preparation 1f5bbd0');
    expect(reviews).toContain('all-unit baseline timed out without a complete report');
    expect(reviews).toContain('no EmDash integration or permitted fetches');
  });
  it('distinguishes provisional merchant queue preparation from live adoption', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-merchant-cart-queue');
    expect(report).toContain('data-merchant-cart-queue-history');
    expect(report).toContain('Previous dispatch · Queued cart changes');
    expect(report).toContain('explicitly selected Light and Dark');
    expect(report).toContain('only this report is deployed: live Commerce remains 0.8.0');
    expect(reviews).toContain('data-merchant-cart-queue-review');
    expect(reviews).toContain('off-live Field Journal 1e24719');
    expect(reviews).toContain('real eight-write budget remains enabled');
    expect(reviews).toContain('two inherited legacy markup assertions remain unresolved');
    for (const source of [report, reviews]) {
      expect(source).toContain('/pr-proof/merchant-cart-queue/after-1440-light.png');
      expect(source).toContain('/pr-proof/merchant-cart-queue/after-390-dark.png');
    }
  });
  it('separates the proposed queued-change repair from the deployed 0.8 cart', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-server-cart-concurrency');
    expect(report).toContain('data-server-cart-concurrency-history');
    expect(report).toContain('Previous dispatch · Cart recovery');
    expect(report).toContain('workaround, not a repair');
    expect(report).toContain('only this report ships on stable 0.8.0');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/issues/242');
    expect(report).toContain('data-cart-queue-proposal');
    expect(report).toContain('data-cart-queue-proposal-history');
    expect(report).toContain('Only reporting ships here: the live 0.8 cart');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/pull/243');
    expect(reviews).toContain('fork d0a950a');
    expect(reviews).not.toContain('No fix branch or PR exists yet');
    expect(reviews).toContain('no checkout, order or hosted-service mutation occurred');
  });
  it('labels bounded qualification teardown as operator-only, not another checkout qualification', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('data-qualification-cleanup');
    expect(report).toContain('data-qualification-cleanup-history');
    expect(report).toContain('Previous dispatch · Installed beta, complete theme');
    expect(report).toContain('https://github.com/saarius/template-store/commit/dfeb50d');
    expect(report).toContain('operator-tool repair, not another commerce qualification');
    expect(report).toContain('only reporting ships here, and Commerce stays on stable 0.8.0');
  });
  it('separates the Registry-installed whole storefront from stable in-place upgrade and hosted payment', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-installed-storefront');
    expect(report).toContain('data-installed-storefront-history');
    expect(report).toContain('Previous dispatch · Real Registry installation');
    expect(report).toContain('The installed plugin. The whole storefront.');
    expect(report).toContain('with no source sandbox mount');
    expect(report).toContain('not an in-place upgrade or hosted purchase');
    expect(reviews).toContain('data-installed-storefront-review');
    expect(reviews).toContain('no Orders, hosted consents or Payments are copied or created');
    expect(reviews).toContain('only reporting ships on stable 0.8.0');
    expect(reviews).toContain('/pr-proof/installed-storefront/cart-desktop-light.jpg');
  });
  it('separates a real fresh Registry install from an in-place stable upgrade', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-registry-install');
    expect(report).toContain('data-registry-install-history');
    expect(report).toContain('Previous dispatch · Merchant HTTPS rehearsal');
    expect(report).toContain('Verified release. Installed for real.');
    expect(report).toContain('not an in-place stable upgrade');
    expect(report).toContain('only reporting ships here while stable remains 0.8.0');
    expect(reviews).toContain('data-registry-install-review');
    expect(reviews).toContain('130929-byte backend hash exactly matches');
    expect(reviews).toContain('no Orders, hosted consents or Payments');
    expect(reviews).toContain('/pr-proof/commerce-beta-registry/verified-consent.jpg');
  });
  it('distinguishes full-source HTTPS qualification from signed installation and hosted payment', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-storefront-https');
    expect(report).toContain('data-storefront-https-history');
    expect(report).toContain('Previous dispatch · Original saved receipts');
    expect(report).toContain('Real forms. A private proving ground.');
    expect(reviews).toContain('data-storefront-https-review');
    expect(reviews).toContain('7465e73');
    expect(reviews).toContain('not production configuration or a signed installation');
    expect(reviews).toContain('no Payments/hosted consents are copied');
    expect(report).toContain('/pr-proof/merchant-storefront-https/cart-desktop-light.jpg');
    expect(report).toContain('signed stable remains 0.8.0');
  });
  it('labels original saved-state sandbox journeys separately from a signed migration', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-installed-retained');
    expect(report).toContain('data-installed-retained-history');
    expect(reviews).toContain('data-installed-retained-review');
    expect(reviews).toContain('88bf394');
    expect(reviews).toContain('not a signed installation, applied upgrade or hosted payment');
    expect(report).toContain('/pr-proof/merchant-retained-runtime/desktop-light.jpg');
    expect(report).toContain('the live store stays on Commerce 0.8.0');
  });
  it('separates actual private source reads from a signed upgrade or browser runtime proof', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-retained-storage');
    expect(report).toContain('data-retained-storage-history');
    expect(reviews).toContain('data-retained-storage-review');
    expect(reviews).toContain('8215265');
    expect(reviews).toContain('OS-level network isolation');
    expect(reviews).toContain('not installed-artifact migration or original-browser rendering');
    expect(report).toContain('three Regular/Sale pairs');
    expect(report).toContain('the live store remains on Commerce 0.8.0');
  });
  it('labels the public catalog fixture separately from real storage migration', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-public-catalog-cart');
    expect(report).toContain('data-public-catalog-cart-history');
    expect(reviews).toContain('data-public-catalog-cart-review');
    expect(reviews).toContain('b599c9f');
    expect(reviews).toContain('Four omitted child SKUs use explicit fixture aliases');
    expect(reviews).toContain('Stable remains 0.8.0');
    expect(report).toContain('this is not storage migration, signed-plugin or hosted payment proof');
  });
  it('keeps receipt artwork staging and missing canonical identity separate from live migration', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('data-receipt-artwork-dispatch');
    expect(report).toContain('data-receipt-artwork-history');
    expect(report).toContain('data-receipt-identity-report');
    expect(report).toContain('Previous dispatch · Concrete feed candidate');
    expect(report).toContain('https://github.com/dinkuskit/commerce/issues/283');
    expect(report).toContain('Only this report is deployed');
    expect(reviews).toContain('merchant preparation 9e4176c');
    expect(reviews).toContain('124 focused units');
    expect(reviews).toContain('not original live Orders, signed installation or a complete regression matrix');
  });
  it('keeps the concrete feed source candidate separate from the signed live exports', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Every size. Its own row.');
    expect(report).toContain('Previous dispatch · Feed member projection');
    expect(report).toContain('data-feed-member-candidate-history');
    expect(report).toContain('https://github.com/dinkuskit/commerce/pull/282');
    expect(reviews).toContain('fork 07e68fe');
    expect(reviews).toContain('five-row XML/CSV exports');
    expect(reviews).toContain('885 unit/workflow and 111 integration cases');
    expect(reviews).toContain('All eleven exact-head GitHub checks pass');
    expect(reviews).toContain('hosts still need to wire selected URLs');
  });
  it('distinguishes the compiled feed-member report from the native control candidate', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Eleven members. Five feed rows.');
    expect(report).toContain('Previous dispatch · Earlier-checkout recovery');
    expect(report).toContain('data-feed-member-report');
    expect(report).toContain('<article class="cycle-entry" data-feed-member-history>');
    expect(report).toContain('<h3>November 15, 2026 · Earlier-checkout recovery</h3>');
    expect(report).toContain('https://github.com/dinkuskit/commerce/issues/281');
    expect(report).toContain('Open bug report, not an implemented repair');
    expect(report).toContain('supplying a family price still loses four sizes');
    expect(report).toContain('separately from feed-control PR #280');
    expect(reviews).toContain('unchanged compiled main');
  });
  it('separates disposable earlier-checkout recovery from original live browsers and signed cutover', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('A new cart. Your earlier receipt.');
    expect(report).toContain('Previous dispatch · Field Journal cart preparation');
    expect(report).toContain('only this report is deployed');
    expect(report).toContain('actual 0.8.0-kernel disposable purchases');
    expect(reviews).toContain('merchant preparation d64e2d1');
    expect(reviews).toContain('not an upstream proposal or deployment');
    expect(reviews).toContain('111 focused units');
    expect(reviews).toContain('does not qualify the real ten Orders');
    expect(reviews).toContain('/pr-proof/retained-receipt-prep/paid-390-dark.png');
  });
  it('keeps Field Journal cart preparation visibly off live', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('Same journal. A new cart underneath.');
    expect(report).toContain('backroadbum/server-cart-prep');
    expect(report).toContain('Original-browser receipt handoff, the signed stable upgrade and the complete regression matrix remain unqualified');
    expect(report).toContain('not a hosted purchase');
    expect(report).toContain('Previous dispatch · Native feed control repair');
  });
  it('separates the native feed control candidate from live release and serializer readiness', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('One product. One feed choice.');
    expect(report).toContain('Previous dispatch · Isolated server-cart qualification');
    expect(reviews).toContain('https://github.com/dinkuskit/commerce/pull/280');
    expect(reviews).toContain('fork 42f0e8a');
    expect(reviews).toContain('minimal mount, not the full CMS editor');
    expect(reviews).toContain('XML/CSV option-member serialization is outside this fix');
    expect(reviews).toContain('signed live plugin is unchanged');
  });
  it('separates source-built beta staging from signed upgrades and live purchases', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('New cart. Old purchases intact.');
    expect(report).toContain('Previous dispatch · Populated catalog feeds');
    expect(report).toContain('source-built staging with synthetic Payments');
    expect(report).toContain('not a signed upgrade or a live checkout');
    expect(report).toContain('development-server suite failed during fixture setup');
    expect(report).toContain('original live browsers, the complete regression matrix and signed merchant artifact qualification remain unfinished');
  });
  it('separates populated JSON proof from native controls and incomplete Google/Meta exports', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('A real feed. Two rough edges.');
    expect(report).toContain('Previous dispatch · Catalog review main sync');
    expect(report).toContain('Google XML and Meta CSV still export only the five simple products');
    expect(reviews).toContain('https://github.com/dinkuskit/commerce/issues/279');
    expect(reviews).toContain('documented, preview-fenced Commerce API');
    expect(reviews).toContain('real HTTPS reads');
    expect(reviews).toContain('no signed UI repair or external enrollment is claimed');
    expect(reviews).toContain('Website checks passed at 18:36 UTC');
  });
  it('reports the catalog main merge separately from the prior green head and shared deployment', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Current main. Same small fix.');
    expect(report).toContain('Previous dispatch · Reading continuity');
    expect(reviews).toContain('fork f4f2cbd');
    expect(reviews).toContain('All 38 owning stages pass across serial runs');
    expect(reviews).toContain('not qualification of this merge');
    expect(reviews).toContain('no shared service is deployed');
  });
  it('archives Steer 6 without claiming feed activation or a live beta upgrade', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const instructions = readFileSync('public/dashboard/instructions/steer-6-2026-11-15.txt', 'utf8');
    expect(report).toContain('without external enrollment');
    expect(report).toContain('Neither track is claimed complete.');
    expect(instructions).toContain('Owner Steer 6 — November 15, 2026');
    expect(instructions).toContain('Never** switch live');
    expect(instructions).toContain('TEST1011');
  });
  it('distinguishes completed own-orders proof from a new checkout or guest fulfillment fix', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('Paid, fulfilled, back in Account.');
    expect(report).toContain('Previous dispatch · Collection reading');
    expect(report).toContain('no new checkout, signed-plugin change or upstream submission was made');
    expect(report).toContain('https://github.com/dinkuskit/commerce/issues/275');
    expect(report).toContain('guest receipt fulfillment remains');
  });
  it('reports published collection reading without claiming a commerce or content write', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('From the shelf to the story.');
    expect(report).toContain('Previous dispatch · Bandana details');
    expect(report).toContain('actual rendered product links');
    expect(report).toContain('no CMS, catalog, account, order or payment write is involved');
  });
  it('reports native bandana content without inventing commerce or tested-sample claims', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('Small square. Clearer details.');
    expect(report).toContain('Previous dispatch · Catalog CI follow-up');
    expect(report).toContain('Native bandana details');
    expect(report).toContain('href="/products/switchback-bandana"');
    expect(report).toContain('no protective performance rating is claimed');
    expect(report).toContain('all ten Orders and unrelated CMS/catalog rows are unchanged');
    expect(report).toContain('original gallery and $14 in-stock Commerce facts retained');
  });
  it('updates catalog CI success without erasing historical failures or claiming a runner diagnosis', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Verified locally. Still blocked in CI.');
    expect(report).toContain('Previous dispatch · Account review handoff');
    expect(report).toContain('CI still cancelled rather than green');
    expect(reviews).toContain('nine local syscall-traced runner tests');
    expect(reviews).toContain('complete Website checks retry now passes');
    expect(reviews).toContain('https://github.com/dinkuskit/dinkuskit/actions/runs/43665891596');
    expect(reviews).toContain('do not diagnose that historical socket');
  });
  it('distinguishes merchant profile corrections from generic qualification and real account writes', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Find the field. Keep the draft.');
    expect(report).toContain('Previous dispatch · Tote details');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/issues/238');
    expect(reviews).toContain('83ec0a8');
    expect(reviews).toContain('not real authentication or profile changes');
    expect(report).toContain('A visible next step, upstream.');
    expect(report).toContain('Previous dispatch · Account corrections');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/pull/239');
    expect(reviews).toContain('ab22702');
    expect(reviews).toContain('22 targeted browser passes');
    expect(reviews).toContain('exact-head desktop, phone, Registry, Playground and aggregate CI passed at 12:09 UTC');
    expect(reviews).toContain('Review was requested after completion');
    expect(reviews).toContain('test racing the previous synthetic save response');
    expect(report).toContain('A small fix. The whole matrix.');
    expect(report).toContain('Previous dispatch · Starter address corrections');
    expect(reviews).toContain('not a new signed-plugin release');
  });
  it('keeps native tote content separate from Commerce facts and untested sample claims', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('Native tote details');
    expect(report).toContain('The small things, together.');
    expect(report).toContain('href="/products/glovebox-field-tote"');
    expect(report).toContain('saved draft stayed private until native publication');
    expect(report).toContain('dimensions are illustrative, not a measured sample');
    expect(report).toContain('Commerce still supplies $32 and backorder availability');
    expect(report).toContain('all ten Orders and unrelated CMS/catalog rows unchanged');
    expect(report).toContain('Previous dispatch · Checkout defaults');
  });
  it('separates obsolete checkout defaults from existing guest drafts and real account writes', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('Fresh defaults. No old address.');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/issues/236');
    expect(reviews).toContain('bd68be4');
    expect(reviews).toContain('already entered guest drafts are not cleared');
    expect(reviews).toContain('no account, order or payment write is involved');
    expect(reviews).toContain('https://github.com/dinkuskit/template-store/pull/237');
    expect(reviews).toContain('5a2980e');
    expect(reviews).toContain('aggregate CI passed at 09:40 UTC');
    expect(reviews).toContain('review was requested after completion');
    expect(reviews).toContain('pending server-cart #229 retains the same prefill boundary');
    expect(report).toContain('Starter checkout default isolation');
    expect(report).toContain('no live account, payment or business record changes were made');
    expect(report).toContain('Previous dispatch · Runner qualification');
  });
  it('distinguishes the runner preflight repair from the unresolved historical collision', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('A bound port is not a free port.');
    expect(report).toContain('https://github.com/dinkuskit/dinkuskit/issues/132');
    expect(report).toContain('One small fix. The full gate.');
    expect(reviews).toContain('https://github.com/dinkuskit/dinkuskit/pull/133');
    expect(reviews).toContain('All 38 owning stages pass across serial runs');
    expect(reviews).toContain('No single clean local verify run is claimed');
    expect(reviews).toContain('full exact-head GitHub CI passed at 07:33 UTC');
    expect(reviews).toContain('shared-store socket failure reproduces on unchanged main');
    expect(report).toContain('Previous dispatch · Runner reliability');
    expect(report).toContain('Previous dispatch · Shared client repair');
    expect(report).toContain('failure shape, not the historical CI socket owner');
    expect(reviews).toContain('3db2787');
    expect(reviews).toContain('source-only test helper, not deployed commerce code');
    expect(reviews).toContain('later bind race remain unresolved');
  });
  it('separates upstream Account qualification from the baseline admin failure and live business writes', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(report).toContain('https://github.com/dinkuskit/template-store/pull/235');
    expect(report).toContain('From store finding to starter fix.');
    expect(report).toContain('Previous dispatch · Account continuity');
    expect(reviews).toContain('afe02f4');
    expect(reviews).toContain('74 focused browser cases');
    expect(reviews).toContain('failure also reproduces on unchanged main');
    expect(report).toContain('No account, order, catalog or plugin changes were made');
    expect(reviews).toContain('not a new signed plugin');
  });
  it('separates intercepted Account continuity proof from real writes and upstream qualification', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(report).toContain('https://github.com/dinkuskit/template-store/issues/234');
    expect(report).toContain('One displayed shopper. One session.');
    expect(report).toContain('not an upstream PR or backend authorization change');
    expect(report).toContain('without real account writes');
    expect(report).toContain('generic main/head proof and full owning verification remain prerequisites');
    expect(report).toContain('Previous dispatch · Downstream adoption');
  });
  it('separates accepted source and the locally qualified catalog proposal from deployments', () => {
    const report = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect((reviews.match(/state: 'Merged November 15'/g) ?? []).length).toBe(6);
    expect(reviews).toContain('a665a86');
    expect(reviews).toContain('https://github.com/dinkuskit/dinkuskit/pull/130');
    expect(reviews).toContain('37 owning local verification stages pass across serial runs');
    expect(reviews).toContain('complete Website checks retry now passes');
    expect(reviews).toContain('on unchanged head d0b72c8');
    expect(reviews).toContain('review is requested after completion');
    expect(reviews).toContain('Earlier attempts stopped at passkey verification');
    expect(reviews).toContain('no shared catalog is deployed');
    expect(reviews).toContain('source verification is not a release or shared-service deployment');
    expect(report).toContain('Six repairs accepted. One-way adoption.');
    expect(report).toContain('both Account feature-map paths');
    expect(report).toContain('explicitly synthetic local feed');
  });
  it('separates generic shell proof from the custom merchant shell and business actions', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('https://github.com/dinkuskit/template-store/pull/232');
    expect(source).toContain('not a visual change to our already-sized Field Journal shell');
    expect(source).toContain('no catalog, account, payment or shipping action changes');
    expect(source).toContain('the separate inherited policy eyebrow finding');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    expect(reviews).toContain('aa13a38');
    expect(reviews).toContain("review.state ?? 'Open · checks passing'");
  });
  it('separates opt-in archived runtime proof from unattended media checks and remaining recovery gaps', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const coverage = source.match(/<div><dt>Recovery coverage<\/dt>[\s\S]*?<\/div>/)?.[0];
    const dispatch = source.match(/<article[^>]+data-cutover-recovery-dispatch>[\s\S]*?<\/article>/)?.[0];
    const history = source.match(/<article[^>]+data-cutover-recovery-history>[\s\S]*?<\/article>/)?.[0];
    expect(coverage).toContain('Backups check ready media sizes and hashes automatically.');
    expect(coverage).toContain('both retained storefront releases opened the same archive in isolation');
    expect(coverage).toContain('Both used the installed dependency tree.');
    expect(coverage).toContain('Admin sign-in, hosted authorization and off-host recovery were not tested.');
    expect(dispatch).toContain('The live store was not rolled back');
    expect(history).toContain('switching only the release cannot undo a database migration');
    expect(source).toContain('An existing private archive now boots');
  });
  it('separates starter contrast repair from adaptive merchant surfaces and real account activity', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('https://github.com/dinkuskit/template-store/pull/231');
    expect(source).toContain('No real email, profile or order changes are involved');
    expect(source).toContain('shared starter header/footer findings remain separate');
    expect(source).toContain('merchant-only inherited scheme');
  });
  it('qualifies the code-input PR without presenting intercepted calls as real account activity', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('Complete sign-in codes');
    expect(source).toContain('https://github.com/dinkuskit/template-store/pull/230');
    expect(source).toContain('no new email, purchase or fulfillment is performed');
    expect(source).toContain('also reproduced on unchanged main');
    const input = readFileSync('src/features/shopper-account/ShopperAccount.astro', 'utf8');
    const code = input.match(/<input id="account-code"[^>]+>/)?.[0];
    expect(code).toBeDefined();
    expect(code).not.toContain('maxlength');
  });
  it('reports the native seventh product without rewriting older catalog or recovery claims', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const pulse = readFileSync('src/features/experiment-report/DashboardPulse.astro', 'utf8');
    expect(pulse).toContain('Seven product families, two collections and ten field notes');
    expect(source).toContain('Seven EmDash-backed product families');
    expect(source).toContain('A $12 pocket notebook joins the gear shelf');
    expect(source).toContain('The six existing products and eight Orders remain unchanged');
    expect(source).toContain('href="/products/county-line-field-book"');
  });

  it('separates verified original checkout release from unknown provider cause', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const current = source.match(/<div><dt>Unpaid recovery<\/dt>[\s\S]*?<\/div>/)?.[0];
    expect(current).toContain('now return released-retry');
    expect(current).toContain('durably record expired-unpaid');
    expect(current).toContain('without a replacement start');
    expect(current).toContain('the maintainer closed #118 November 20 as resolved by #119');
    expect(current).toContain('provider objects and exact deployed source remain independently unverified');
    expect(current).not.toContain('still pending');
    const pulse = readFileSync('src/features/experiment-report/DashboardPulse.astro', 'utf8');
    expect(pulse).toContain('original expired attempts now release');
    expect(source).toContain('a scoped404 is not proof of absence');
    expect(source).toContain('Four actual-store browser checks');
  });

  it('keeps the report redesign server-rendered and preserves native evidence disclosure', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('<DashboardPulse status={status} stale={stale} />');
    expect(source.match(/<DashboardEvidence summary=/g)).toHaveLength(18);
    const evidence = readFileSync('src/features/experiment-report/DashboardEvidence.astro', 'utf8');
    expect(evidence).toContain('<details class="dashboard-evidence">');
    expect(evidence).toContain('<slot />');
    for (const file of ['DashboardReport', 'DashboardPulse', 'DashboardReviews', 'DashboardShowcase', 'DashboardEvidence']) {
      expect(readFileSync(`src/features/experiment-report/${file}.astro`, 'utf8')).not.toMatch(/<script\b/);
    }
    const pulse = readFileSync('src/features/experiment-report/DashboardPulse.astro', 'utf8');
    expect(pulse).toContain("stale ? 'Stale advisory'");
    expect(pulse).toContain('not a payment');
    expect(pulse).toContain('Page responses · 7 UTC days');
    expect(pulse).toContain('Bot-filtered · repeat views included');
    expect(pulse).toContain("trafficReady ? value(status?.traffic?.last7Days) : 'Unavailable'");
    expect(source).toContain('not people, sessions or sales');
    expect(source).toContain('Unique visitors / visitor orders');
    const css = readFileSync('src/features/experiment-report/dashboard.css', 'utf8');
    expect(css).toContain('font-variant-numeric:tabular-nums');
    expect(css).toContain('var(--dashboard-title)');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('links all six original surfaces to final Light, Dark and phone captures', () => {
    const showcase = readFileSync('src/features/experiment-report/DashboardShowcase.astro', 'utf8');
    const rows = [...showcase.matchAll(/\{ title: '[^']+', before: '[^']+', light: '[^']+', dark: '[^']+', mobile: '[^']+' \}/g)];
    expect(rows).toHaveLength(6);
    expect(showcase).toContain('not a new purchase');
    const reviews = readFileSync('src/features/experiment-report/DashboardReviews.astro', 'utf8');
    for (const head of ['40e95ea', '9123f4d', '92fbb24', 'a665a86', '267de74']) expect(reviews).toContain(head);
    expect(reviews).toContain('source verification is not a release');
  });

  it('separates saved-cart, variant and checkout-form proof from payment readiness and deployment claims', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('Hosted checkout settings #124');
    expect(source).toContain('Current Before/After captures for reviewed UI PRs');
    expect(source).toContain('Checkout contact #223');
    expect(source).toContain('synthetic checkout protocol and an admission flag');
    expect(source).toContain('its own edits clear the correction without moving focus');
    expect(source).toContain('closed without merge on November 13 at16:15');
    expect(source).toContain('Cart return #220');
    expect(source).toContain('trusted browser tab returns');
    expect(source).toContain('same saved intent and focused quantity element');
    expect(source).toContain('one worker, disclosed 15-second local timeout');
    expect(source).toContain('not a new signed installation, real BFCache restoration or payment-readiness proof');
    expect(source).toContain('Saved-cart names #218');
    expect(source).toContain('without snapshot interception');
    expect(source).toContain('not a signed installation or payment-readiness proof');
    expect(source).toContain('Variant cards #216');
    expect(source).toContain('the isolated fixture does not prove payment readiness');
    expect(source).toContain('mixed family Out of stock becomes In stock');
    expect(source).toContain('not a new signed installation or hosted settings submission');
    expect(source).toContain('normal November 12 stop at 22:24 UTC');
    expect(source).toContain('do not prove continuous uptime or background-job drain');
    expect(source).toContain('initial activation was not a live shutdown test');
  });

  it('separates installed desktop continuation proof from the phone drawer limitation', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('Product-card continuation #267');
    expect(source).toContain('unsigned local installed Registry-format proof');
    expect(source).toContain('head retains Shipping and -1, saves 7 oz directly');
    expect(source).toContain('entire Settings drawer disappeared after a successful save on both sources');
    expect(source).toContain('invalid-save phone continuation is not qualified');
    expect(source).toContain('The signed Commerce plugin and live catalog stay unchanged');
    expect(source.match(/<li>/g)?.length).toBeGreaterThanOrEqual(8);
  });

  it('reports the observed phone focus chain without claiming a repaired host', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const finding = source.match(/<li>At phone width,[\s\S]*?<\/li>/)?.[0];
    expect(finding).toContain('detaches its focused button');
    expect(finding).toContain('click and keyboard Enter');
    expect(finding).toContain('without another save');
    expect(finding).toContain('not a fix');
    expect(finding).toContain('owning repair remains for human review');
    for (const name of ['before-save-390', 'after-save-390']) {
      expect(finding).toContain(`/pr-proof/emdash-phone-settings/${name}.png`);
    }
    const ledger = readFileSync('public/dashboard/emdash-bugs.txt', 'utf8');
    expect(ledger).toContain('Kumo2.6.0 Sidebar');
    expect(ledger).toContain('null `relatedTarget`');
    expect(ledger).toContain('No host/plugin patch, event suppression or response interception');
    expect(ledger).toContain('Phone invalid-save continuation is NOT qualified');
  });

  it('records native order focus loss as a human-review observation, not a repair', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const ledger = readFileSync('public/dashboard/emdash-bugs.txt', 'utf8');
    expect(source).toContain('data-order-navigation-history');
    expect(source).toContain('reaching Back to orders then takes 32 desktop or five phone Tabs');
    expect(source).toContain('not a repair or private order capture');
    expect(ledger).toContain('## 12. Native Orders inspection loses');
    expect(ledger).toContain('without a post-update focus policy');
    expect(ledger).toContain('not a universal tab-order contract');
    expect(ledger).toContain('No host/plugin repair is installed');
    expect(ledger).toContain('No EmDash issue, PR or comment was opened');
    for (const state of ['before', 'after']) expect(source).toContain(`/pr-proof/emdash-order-focus/${state}-inspect-390.png`);
  });

  it('separates served Ship proof from hosted deployment and carrier qualification', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('actual served Worker-route Before/After desktop and phone proof');
    expect(source).toContain('stores the box through a native POST and reload');
    expect(source).toContain('fits 390px rather than 532px');
    expect(source).toContain('Local synthetic sessions and practice history are not a hosted deployment or carrier proof');
    expect(source).toContain('Fresh review accepts both served proofs at 5/6 with no findings');
    expect(source).toContain('Fresh review separately accepts a733bcd’s installed proof at 5/6');
    expect(source).toContain('fresh review accepts 1c808f0’s proof at 5/6');
    expect(source).toContain('no live record or label changed');
    expect(source).not.toContain('Ship’s substantive CI remains approval-gated');
    for (const slug of ['fix/settings-box-label', 'fix/label-history-phone']) {
      const row = source.match(new RegExp(`<tr><td><a href="https://github.com/saarius/ship/tree/${slug}">.*?</tr>`))?.[0];
      expect(row).toContain('actual served');
      expect(row).toContain('owning GitHub tests pass');
      expect(row).toContain('One fresh re-review was requested');
    }
  });

  it('qualifies installed Ship weight proof without claiming hosted integration or a signed release', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const row = source.match(/<tr><td><a href="https:\/\/github.com\/saarius\/ship\/tree\/fix\/missing-item-weight">.*?<\/tr>/)?.[0];
    expect(source).toContain('Native package weight #97');
    expect(source).toContain('A total that admits what is missing');
    expect(row).toContain('without browser response interception');
    expect(row).toContain('same added regressions fail on main’s missing warning and pass on head');
    expect(row).toContain('both retain the entered 16.5 oz after See prices');
    expect(row).toContain('Unsigned local Registry-shaped installations use synthetic issuer and hosted HTTP ports');
    expect(row).toContain('exact-head owning GitHub CI is green');
    expect(row).toContain('fresh review accepts e838486’s installed proof at 5/6 with no findings');
    expect(row).toContain('the signed store plugin remains unchanged');
    expect(row).not.toContain('CI awaits maintainer approval');
  });

  it('separates captured selected metadata from compatibility approval and signed deployment', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const row = source.match(/<tr><td><a href="https:\/\/github.com\/saarius\/template-store\/tree\/fix\/selected-variant-jsonld">.*?<\/tr>/)?.[0];
    expect(source).toContain('Selected metadata #214');
    expect(source).toContain('The selected size owns its identity');
    expect(row).toContain('24 selected cases and eight preserved simple-product Offers');
    expect(row).toContain('without response interception');
    expect(row).toContain('intentionally retain the visible parent SKU');
    expect(row).toContain('not claimed as a fresh local pass');
    expect(row).toContain('owner approved the legacy no-Offer contract');
    expect(row).toMatch(/no signed release or live plugin replacement/i);
  });

  it('reports quantity restoration separately from the implemented family revision', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('Cart quantity #212');
    expect(source).toContain('in-memory 2/$48 while persisted intent stays 3');
    expect(source).toContain('no payment starts, errors or overflow');
    expect(source).toContain('merchant’s different retained-draft repair is not used as proof');
    expect(source).toContain('Implements the maintainer’s requested family summary');
    expect(source).toContain('same helper is dogfooded in this theme');
    expect(source).toContain('Fresh review accepts #223’s field-level contact proof');
  });

  it('distinguishes merged source from open review and signed deployment', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    expect(source).toContain('three fork PRs remain open');
    expect(source).toContain('Thirteen source fixes are merged upstream');
    expect(source).toContain('Pictures without a script');
    expect(source).toContain('9123f4d');
    expect(source).toContain('synthetic Chromium touch');
    expect(source).toContain('closed without merge on November 13 at16:15');
    expect(source).toContain('now contains a server-cart implementation candidate');
    expect(source).toContain('merged upstream November 13 at16:10 as27fd637');
    expect(source).toContain('Closed by merged PR #212');
    const ship = source.match(/<tr><td><a href="https:\/\/github.com\/saarius\/ship\/tree\/fix\/label-history-phone">.*?<\/tr>/)?.[0];
    expect(ship).toContain('1598a92');
    expect(ship).toContain('main bfb95f3 was merged without rebasing');
    expect(ship).toContain('maintainers merged the source at 15:00 UTC');
    expect(source).toContain('Closed November 13 on owner confirmation of merged source repair PR #96');
    expect(source).toContain('commerce/pull/271');
    expect(source).toContain('commerce/pull/273');
    expect(source).toContain('existing test orders are not resynced');
    const metadata = source.match(/<tr><td><a href="https:\/\/github.com\/saarius\/template-store\/tree\/fix\/selected-variant-jsonld">.*?<\/tr>/)?.[0];
    expect(metadata).toContain('40e95ea');
    expect(metadata).toContain('changing no runtime, test or pin');
    for (const number of [261, 263]) expect(source).toContain(`PR #${number}</a> merged upstream November 13`);
    expect(source).toContain('3285ebc</a>, merged upstream November 13');
    expect(source).toContain('a merge is not a signed release or deployment');
    for (const [repo, number] of [['commerce', 266], ['ship', 94], ['ship', 97], ['template-store', 220], ['template-store', 223]] as const) {
      expect(source).toContain(`https://github.com/dinkuskit/${repo}/pull/${number}\">PR #${number}</a>, merged upstream November 13`);
    }
    expect(source).toContain('1c808f0</a>, merged upstream November 13 for');
    expect(source).toContain('73d8523</a>, merged upstream November 13 with green CI');
    expect(source).toContain('owner has now approved the additive public contract');
    expect(source).toContain('Closed November 13 by merged');
  });

  it('distinguishes the native account-tab candidate from hosted setup and new-head review', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const row = source.match(/<tr><td><a href="https:\/\/github.com\/saarius\/dinkuskit\/tree\/fix\/checkout-settings-layout">.*?<\/tr>/)?.[0];
    expect(source).toContain('One settings task at a time');
    expect(row).toContain('Plugins/Shipping/Payments');
    expect(row).toContain('independent native saves');
    expect(row).toContain('legacy combined POST');
    expect(row).toContain('51 shared-store tests');
    expect(row).toContain('unchanged main 662dd47');
    expect(row).toContain('all three candidate tabs');
    expect(row).toContain('not a new signed installation or hosted settings submission');
    expect(row).toContain('is published at');
    expect(row).toContain('92fbb24');
    expect(row).toContain('Every local verification stage passes across serial runs');
    expect(row).toContain('unchanged-source retry, with cause unproven');
    expect(row).toContain('Full exact-head GitHub verification passes');
    expect(row).toContain('Fresh review accepts 92fbb24’s screenshot/native-save proof with no findings');
    expect(row).toContain('not shared-deployed');
    expect(row).not.toContain('still running');
    expect(row).not.toContain('not pushed');
    const currentReviews = source.match(/<section id="contributions"><h2>Reviews &amp; accepted fixes<\/h2>[\s\S]*?<\/section>/)?.[0];
    expect(currentReviews).toContain('PR #229');
    expect(currentReviews).toContain('580a054 paired with');
    expect(currentReviews).toContain('not to merge it alone');
    expect(currentReviews).not.toContain('ledger-only');
    expect(currentReviews).not.toContain('awaiting full qualification');
  });

  it('keeps instruction versions ordered and archives the live-dependency guard', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const archivePaths = [...source.matchAll(/href="(\/dashboard\/instructions\/[^" ]+)"/g)].map(match => match[1]);
    expect(archivePaths).toEqual([
      '/dashboard/instructions/original-2026-11-09.txt',
      '/dashboard/instructions/steer-1-2026-11-10.txt',
      '/dashboard/instructions/steer-2-2026-11-11.txt',
      '/dashboard/instructions/steer-3-2026-11-12.txt',
      '/dashboard/instructions/steer-4-2026-11-13.txt',
      '/dashboard/instructions/steer-5-2026-11-14.txt',
      '/dashboard/instructions/steer-6-2026-11-15.txt',
      '/dashboard/instructions/steer-7-2026-11-20.txt',
      '/dashboard/instructions/steer-8-2026-11-22.txt',
      '/dashboard/instructions/steer-9-2026-11-22.txt',
      '/dashboard/instructions/steer-10-2026-11-22.txt',
      '/dashboard/instructions/steer-11-2026-11-23.txt',
    ]);
    const steer = readFileSync('public' + archivePaths[2], 'utf8');
    expect(steer).toContain('## Owner Steer 2 — November 11, 2026');
    expect(steer).toContain('clean pushed branch and local verification is complete');
    for (const directory of ['node_modules', '.artifacts', 'dist', '.astro', 'test-results']) expect(steer).toContain('`' + directory + '`');
    expect(steer).toContain('Never remove `node_modules` from the primary');
    expect(steer).toContain('once their upstream PRs merge or close');
    for (const path of archivePaths.slice(0, 2)) expect(readFileSync('public' + path, 'utf8')).not.toContain('Owner Steer 2');
    const mediaSteer = readFileSync('public' + archivePaths[3], 'utf8');
    expect(mediaSteer).toContain('Owner Steer 3 — November 12, 2026');
    expect(mediaSteer).toContain('Before (unchanged `main`) and After (PR head)');
    expect(mediaSteer).toContain('@clawsweeper re-review');
    const designSteer = readFileSync('public' + archivePaths[4], 'utf8');
    expect(designSteer).toContain('Owner Steer 4 — November 13, 2026');
    expect(designSteer).toContain('ui-design');
    expect(designSteer).toContain('System / Light / Dark');
    expect(designSteer).toContain('Phased Rollout');
    const cartSteer = readFileSync('public' + archivePaths.at(-1), 'utf8');
    expect(cartSteer).toContain('## Owner Steer 11 — November 23, 2026');
    expect(cartSteer).toContain('dinkuskit/template-store#249');
    expect(cartSteer).toContain('Poll open issues as well as open PRs');
  });

  it.each([
    ['index', '<DashboardReport />'],
    ['history', '<DashboardReport view="history" />'],
    ['contributions', '<DashboardReport view="contributions" />'],
  ])('keeps %s dynamic and sets no-store in the page, not its child component', (route, view) => {
    const source = readFileSync(`src/pages/dashboard/${route}.astro`, 'utf8');
    expect(source).toContain('export const prerender = false;');
    expect(source).toContain("Astro.response.headers.set('Cache-Control', 'no-store');");
    expect(source).toContain(view);
  });
});
