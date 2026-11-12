import {
  acquireGuestCheckoutAdmission,
  parseCheckoutReadiness,
  type InstalledCheckoutReadinessContext,
  type InstalledCheckoutRuntime,
} from './checkout-admission.js';

export type MerchantReadinessOutcome =
  | 'supported'
  | 'admission-refused'
  | 'dispatcher-rejected'
  | 'dispatcher-exception'
  | 'contract-rejected'
  | 'plugin-unavailable';

/** Observe the existing admission call, not a second probe or an alternate gate.
 * The facade preserves optional metadata and binds methods to their real owner.
 * No request, response, exception, identifier or credential is retained. */
export async function diagnoseMerchantReadiness(
  context: InstalledCheckoutReadinessContext,
  clock: () => number = () => performance.now(),
): Promise<{ ready: boolean; outcome: MerchantReadinessOutcome; elapsedMs: number }> {
  const start = clock();
  let outcome: MerchantReadinessOutcome = 'admission-refused';
  const owner = context.runtime;
  let runtime: InstalledCheckoutRuntime | null = null;
  if (owner) {
    runtime = {};
    if (typeof owner.getPluginRouteMeta === 'function') {
      runtime.getPluginRouteMeta = owner.getPluginRouteMeta.bind(owner);
    }
    if (typeof owner.getRuntimePluginSettingsSchema === 'function') {
      runtime.getRuntimePluginSettingsSchema = owner.getRuntimePluginSettingsSchema.bind(owner);
    }
    if (typeof owner.handlePublicPluginApiRoute === 'function') {
      runtime.handlePublicPluginApiRoute = async (...args) => {
        try {
          const result = await owner.handlePublicPluginApiRoute!(...args);
          if (result?.success !== true) outcome = 'dispatcher-rejected';
          else {
            const parsed = parseCheckoutReadiness(result.data);
            outcome = !parsed ? 'contract-rejected'
              : parsed.status === 'unavailable' ? 'plugin-unavailable' : 'admission-refused';
          }
          return result;
        } catch (error) {
          outcome = 'dispatcher-exception';
          throw error;
        }
      };
    }
  }
  // Preserve the health route's original fail-closed behavior, including metadata errors.
  const ready = Boolean(await acquireGuestCheckoutAdmission({ ...context, runtime }).catch(() => null));
  return { ready, outcome: ready ? 'supported' : outcome,
    elapsedMs: Math.max(0, Math.round(clock() - start)) };
}

export function merchantReadinessFailureEvent(
  diagnostic: Awaited<ReturnType<typeof diagnoseMerchantReadiness>>,
): { event: string; schema: string; observedAt: string; outcome: MerchantReadinessOutcome; elapsedMs: number; http: number } | null {
  if (diagnostic.ready) return null;
  return { event: 'checkout-admission-unavailable', schema: 'backroadbum.checkout-admission/v1',
    observedAt: new Date().toISOString(), outcome: diagnostic.outcome,
    elapsedMs: diagnostic.elapsedMs, http: 503 };
}
