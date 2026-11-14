import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Backroad Bum dashboard route boundaries', () => {
  it('separates verified original checkout release from unknown provider cause', () => {
    const source = readFileSync('src/features/experiment-report/DashboardReport.astro', 'utf8');
    const current = source.match(/<div><dt>Unpaid recovery<\/dt>[\s\S]*?<\/div>/)?.[0];
    expect(current).toContain('now return released-retry');
    expect(current).toContain('durably record expired-unpaid');
    expect(current).toContain('without a replacement start');
    expect(current).toContain('provider objects and exact deployed source remain unverified');
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
    expect(pulse).toContain('Aggregate counting is not wired yet');
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
    for (const head of ['40e95ea', '9123f4d', '92fbb24']) expect(reviews).toContain(head);
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
    const currentReviews = source.match(/<section id="contributions"><h2>Open reviews<\/h2>[\s\S]*?<\/section>/)?.[0];
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
