import { describe, expect, it, vi } from 'vitest';
import { checkDemoPosture } from '../../scripts/verify-backroadbum-demo-posture.mjs';

const demo = { 'X-Robots-Tag': 'NoIndex, nofollow' };
const healthy = { admission: 'open', readiness: 'supported', mode: 'test' };
function fixture(overrides: Record<string, () => Response> = {}) {
  return vi.fn<typeof fetch>(async (url, init) => {
    const { hostname, pathname } = new URL(String(url));
    expect(init).toMatchObject({ method: 'GET', redirect: 'manual', headers: { 'User-Agent': 'BackroadBum-SelfCheck/1.0' } });
    expect('body' in (init ?? {})).toBe(false);
    expect(['www.backroadbum.com', 'backroadbum.com']).toContain(hostname);
    if (overrides[pathname]) return overrides[pathname]();
    if (hostname === 'www.backroadbum.com') return Response.redirect('https://backroadbum.com/shop', 301);
    if (pathname === '/_emdash/admin' || pathname === '/proof') return new Response(null, { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="restricted"' } });
    if (pathname === '/api/checkout/health') return Response.json(healthy);
    return new Response('DEMO / TEST STORE · 4242 4242 4242 4242', { headers: demo });
  });
}

describe('Backroad Bum demo release posture', () => {
  it('checks public/demo, auth, canonical HTTPS and advisory checkout without credentials or mutations', async () => {
    const request = fixture();
    const result = await checkDemoPosture({ request });
    expect(result.ok).toBe(true);
    expect(result.checks).toHaveLength(15);
    expect(request).toHaveBeenCalledTimes(15);
  });

  it('detects an indexable storefront, public proof route, or wrong checkout mode without logging raw responses', async () => {
    const marker = 'DO-NOT-PRINT';
    const result = await checkDemoPosture({ request: fixture({
      '/test-store': () => new Response('DEMO / TEST STORE', { headers: demo }),
      '/sitemap.xml': () => new Response(marker, { headers: { 'X-Robots-Tag': 'nonequivalent, INDEX' } }),
      '/proof': () => new Response(marker, { status: 401 }),
      '/api/checkout/health': () => Response.json({ ...healthy, mode: 'live', privateValue: marker }),
    }) });
    expect(result.ok).toBe(false);
    expect(result.checks.filter(check => check.result !== 'pass').map(check => check.name)).toEqual([
      'Public demo · /test-store', 'Public demo · /sitemap.xml', 'Basic Auth · /proof', 'Checkout readiness (advisory)',
    ]);
    expect(JSON.stringify(result)).not.toContain(marker);
  });

  it('requires a deliberate pause to be both closed and unavailable without a mode', async () => {
    const request = fixture({
      '/test-store': () => new Response('DEMO / TEST STORE', { headers: demo }),
      '/api/checkout/health': () => Response.json({ admission: 'closed', readiness: 'unavailable', mode: null }, { status: 503 }),
    });
    expect((await checkDemoPosture({ request })).ok).toBe(false);
    expect((await checkDemoPosture({ request, expectClosed: true })).ok).toBe(true);
  });

  it('reports an unavailable route without dumping the request error and still completes the other checks', async () => {
    const result = await checkDemoPosture({ request: fixture({ '/shop': () => { throw Error('DO-NOT-PRINT'); } }) });
    expect(result.ok).toBe(false);
    expect(result.checks).toContainEqual({ name: 'Public demo · /shop', status: null, result: 'response unavailable or invalid' });
    expect(result.checks.at(-1)?.result).toBe('pass');
    expect(JSON.stringify(result)).not.toContain('DO-NOT-PRINT');
  });
});
