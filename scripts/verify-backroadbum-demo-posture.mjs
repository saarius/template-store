// Read-only post-deploy checks. No session, checkout creation, mail or labels.
import { parseArgs } from 'node:util';

const origin = 'https://backroadbum.com';
const publicPaths = [
  '/', '/shop', '/field-notes', '/test-store', '/checkout', '/dashboard',
  '/robots.txt', '/sitemap.xml', '/feeds/agent-catalog.json', '/feeds/google-merchant.xml', '/feeds/meta-catalog.csv',
];
const protectedPaths = ['/_emdash/admin', '/proof'];
const shopAlias = 'https://www.backroadbum.com/shop';

export async function checkDemoPosture({ request = fetch, expectClosed = false } = {}) {
  const checks = [];
  async function check(name, url, verify) {
    let response;
    try {
      response = await request(url, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'BackroadBum-SelfCheck/1.0' },
      });
      checks.push({ name, status: response.status, result: await verify(response) });
    } catch {
      // Do not print raw errors, provider responses, header values, or bodies.
      checks.push({ name, status: response?.status ?? null, result: 'response unavailable or invalid' });
    } finally {
      if (response?.body && !response.bodyUsed) await response.body.cancel().catch(() => {});
    }
  }
  for (const path of publicPaths) {
    await check(`Public demo · ${path}`, origin + path, async response => {
      if (response.status !== 200) return 'expected HTTP 200';
      const directives = new Set(response.headers.get('x-robots-tag')?.toLowerCase().split(',').map(part => part.trim()));
      if (!directives.has('noindex') || !directives.has('nofollow')) return 'expected noindex, nofollow';
      if (path === '/checkout' || path === '/test-store') {
        const html = await response.text();
        if (!html.includes('DEMO / TEST STORE')) return 'expected the shopper test-store notice';
        if (path === '/test-store' && !expectClosed && !html.includes('4242 4242 4242 4242')) return 'expected Stripe test-card instructions';
      }
      return 'pass';
    });
  }
  for (const path of protectedPaths) {
    await check(`Basic Auth · ${path}`, origin + path, response =>
      response.status === 401 && /^Basic\s/iu.test(response.headers.get('www-authenticate') ?? '') ? 'pass' : 'expected HTTP 401 with Basic challenge');
  }
  await check('HTTPS www redirect', shopAlias, response =>
    [301, 308].includes(response.status) && response.headers.get('location') === `${origin}/shop` ? 'pass' : 'expected a permanent redirect to the canonical shop URL');
  await check('Checkout readiness (advisory)', `${origin}/api/checkout/health`, async response => {
    const expectedStatus = expectClosed ? 503 : 200;
    if (response.status !== expectedStatus) return `expected HTTP ${expectedStatus}`;
    const value = await response.json();
    const matches = expectClosed
      ? value?.admission === 'closed' && value?.readiness === 'unavailable' && value?.mode === null
      : value?.admission === 'open' && value?.readiness === 'supported' && value?.mode === 'test';
    return matches ? 'pass' : expectClosed ? 'expected closed checkout' : 'expected open TEST checkout';
  });
  return { ok: checks.every(check => check.result === 'pass'), checkoutExpected: expectClosed ? 'closed' : 'test', checks };
}

if (import.meta.main) {
  const { values } = parseArgs({ options: { 'expect-closed': { type: 'boolean' } } });
  const result = await checkDemoPosture({ expectClosed: values['expect-closed'] });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
