import type { APIRoute } from 'astro';
import { diagnoseMerchantReadiness, merchantReadinessFailureEvent } from '../../../features/guest-cart/merchant-readiness-diagnostic.server.js';
import { merchantCheckoutClosed } from '../../../features/guest-cart/merchant-policy.js';
export const prerender = false;

/** Non-creating readiness advisory. Never prepares a capability, cart, payment or order. */
export const GET: APIRoute = async ({ request, locals }) => {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.BACKROADBUM_MERCHANT_PROFILE !== '1') return new Response(null, { status: 404, headers });
  const admission = merchantCheckoutClosed() ? 'closed' : 'open';
  let ready = false;
  if (admission === 'open') {
    const diagnostic = await diagnoseMerchantReadiness({ runtime: locals.emdash, request });
    ready = diagnostic.ready;
    const event = merchantReadinessFailureEvent(diagnostic);
    if (event) console.warn(JSON.stringify(event));
  }
  return Response.json({ schema: 'backroadbum.checkout-health/v1', admission,
    readiness: ready ? 'supported' : 'unavailable', mode: ready ? 'test' : null }, { status: ready ? 200 : 503, headers });
};
