import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHECKOUT_READINESS_SCHEMA, type InstalledCheckoutRuntime } from '../../src/features/guest-cart/checkout-admission.js';
import { diagnoseMerchantReadiness, merchantReadinessFailureEvent } from '../../src/features/guest-cart/merchant-readiness-diagnostic.server.js';
import { GET } from '../../src/pages/api/checkout/health.js';

const supported = { schema: CHECKOUT_READINESS_SCHEMA, status: 'supported', mode: 'test' };
const unavailable = { schema: CHECKOUT_READINESS_SCHEMA, status: 'unavailable' };
const request = new Request('https://backroadbum.com/api/checkout/health', {
  headers: { Cookie: 'private-cookie', Authorization: 'private-auth' },
});
function fixture(result: { success: boolean; data?: unknown } = { success: true, data: supported }) {
  return { handlePublicPluginApiRoute: vi.fn(async () => result) };
}
function context(runtime: InstalledCheckoutRuntime | null) {
  return { request, locals: { emdash: runtime } } as unknown as Parameters<typeof GET>[0];
}
beforeEach(() => {
  vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '1');
  vi.stubEnv('BACKROADBUM_HOSTED_REGISTRY', '1');
  vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '1');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('merchant-only admission diagnosis', () => {
  it('makes the same single non-creating GET with no browser credentials', async () => {
    const runtime = fixture();
    const times = [10, 13.6];
    const diagnostic = await diagnoseMerchantReadiness({ runtime, request }, () => times.shift()!);
    expect(diagnostic).toEqual({ ready: true, outcome: 'supported', elapsedMs: 4 });
    expect(merchantReadinessFailureEvent(diagnostic)).toBeNull();
    expect(runtime.handlePublicPluginApiRoute).toHaveBeenCalledTimes(1);
    const [id, method, path, sent] = runtime.handlePublicPluginApiRoute.mock.calls[0] as unknown as [string, string, string, Request];
    expect([id, method, path]).toEqual(['r_gshdrqaldna3r7sn', 'GET', 'checkout/guest/readiness']);
    expect(sent.url).toBe('https://backroadbum.com/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/readiness');
    expect([...sent.headers]).toEqual([]);
    expect(sent.cache).toBe('no-store');
  });
  it.each([
    [{ success: false, data: { message: 'private-error' } }, 'dispatcher-rejected'],
    [{ success: true, data: unavailable }, 'plugin-unavailable'],
    [{ success: true, data: { ...supported, mode: 'live', secret: 'private-key' } }, 'contract-rejected'],
    [{ success: true, data: null }, 'contract-rejected'],
    [{ success: true, data: { ...supported, extra: 'private-response' } }, 'contract-rejected'],
  ] as const)('classifies only fixed stages for %j', async (result, outcome) => {
    const runtime = fixture(result);
    const diagnostic = await diagnoseMerchantReadiness({ runtime, request });
    expect(diagnostic.ready).toBe(false);
    expect(diagnostic.outcome).toBe(outcome);
    expect(runtime.handlePublicPluginApiRoute).toHaveBeenCalledTimes(1);
    const event = merchantReadinessFailureEvent(diagnostic)!;
    expect(Object.keys(event).sort()).toEqual(['elapsedMs', 'event', 'http', 'observedAt', 'outcome', 'schema']);
    expect(JSON.stringify(event)).not.toMatch(/private-|backroadbum\.com|r_gsh/);
    expect(event.observedAt).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
  });
  it('does not retain or log thrown dispatcher exceptions', async () => {
    const runtime = { handlePublicPluginApiRoute: vi.fn(async () => { throw new Error('private-secret'); }) };
    const diagnostic = await diagnoseMerchantReadiness({ runtime, request });
    expect(diagnostic.outcome).toBe('dispatcher-exception');
    expect(JSON.stringify(merchantReadinessFailureEvent(diagnostic))).not.toContain('private');
  });
  it('preserves receiver identity and optional metadata checks', async () => {
    class Runtime {
      #identity = true;
      getPluginRouteMeta(_id: string, path: string) {
        expect(this.#identity).toBe(true);
        return { public: true, methods: [path.endsWith('readiness') ? 'GET' : 'POST'] };
      }
      getRuntimePluginSettingsSchema() { expect(this.#identity).toBe(true); return {}; }
      async handlePublicPluginApiRoute() { expect(this.#identity).toBe(true); return { success: true, data: supported }; }
    }
    expect((await diagnoseMerchantReadiness({ runtime: new Runtime(), request })).ready).toBe(true);
    for (const runtime of [null, {}, { ...fixture(), getPluginRouteMeta: () => null },
      { ...fixture(), getRuntimePluginSettingsSchema: () => null },
      { ...fixture(), getPluginRouteMeta: () => { throw new Error('private-metadata'); } }]) {
      const diagnostic = await diagnoseMerchantReadiness({ runtime, request });
      expect(diagnostic).toMatchObject({ ready: false, outcome: 'admission-refused' });
    }
  });
});

describe('unchanged public health boundary', () => {
  it('returns the same supported contract without a failure log', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await GET(context(fixture()));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ schema: 'backroadbum.checkout-health/v1', admission: 'open', readiness: 'supported', mode: 'test' });
    expect(log).not.toHaveBeenCalled();
  });
  it('keeps diagnosis private on a real refusal and never retries', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = fixture({ success: true, data: unavailable });
    const response = await GET(context(runtime));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ schema: 'backroadbum.checkout-health/v1', admission: 'open', readiness: 'unavailable', mode: null });
    expect(runtime.handlePublicPluginApiRoute).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: 'checkout-admission-unavailable', outcome: 'plugin-unavailable', http: 503 });
  });
  it('does not probe or log a deliberate admission closure or a generic store', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = fixture();
    vi.stubEnv('BACKROADBUM_CHECKOUT_ENABLED', '0');
    const response = await GET(context(runtime));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ schema: 'backroadbum.checkout-health/v1', admission: 'closed', readiness: 'unavailable', mode: null });
    vi.stubEnv('BACKROADBUM_MERCHANT_PROFILE', '0');
    expect((await GET(context(runtime))).status).toBe(404);
    expect(runtime.handlePublicPluginApiRoute).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
