import type { APIRoute } from 'astro';
import { acquireGuestCheckoutAdmission } from '../../../features/guest-cart/checkout-admission.js';
import { merchantCheckoutClosed } from '../../../features/guest-cart/merchant-policy.js';
export const prerender = false;

/** Non-creating readiness advisory. Never prepares a capability, cart, payment or order. */
export const GET: APIRoute = async ({ request, locals }) => {
  const headers = { 'Cache-Control': 'no-store' };
  if (process.env.BACKROADBUM_MERCHANT_PROFILE !== '1') return new Response(null, { status: 404, headers });
  const admission = merchantCheckoutClosed() ? 'closed' : 'open';
  const ready = admission === 'open' && Boolean(await acquireGuestCheckoutAdmission({ runtime: locals.emdash, request }).catch(() => null));
  return Response.json({ schema: 'backroadbum.checkout-health/v1', admission,
    readiness: ready ? 'supported' : 'unavailable', mode: ready ? 'test' : null }, { status: ready ? 200 : 503, headers });
};
