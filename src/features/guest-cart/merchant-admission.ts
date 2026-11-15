import { validateCheckoutBody, MAX_CHECKOUT_BODY_BYTES } from '../playground-checkout/index.js';
import type { LimitedAction } from './merchant-limits.server.js';
import { merchantServerCartMutationPath } from './merchant-policy.js';

const ORIGIN = 'https://backroadbum.com';
export const MERCHANT_PEER_HEADER = 'x-backroadbum-client-ip';
type Take = (action: LimitedAction, peer: string) => { allowed: boolean; retryAfter: number };
function refusal(status: number, code: string, message: string, retryAfter?: number) {
  return Response.json({ ok: false, error: { code, message } }, { status, headers: {
    'Cache-Control': 'no-store', ...(retryAfter ? { 'Retry-After': String(retryAfter) } : {}),
  } });
}
async function boundedBody(request: Request): Promise<string | null> {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_CHECKOUT_BODY_BYTES)) return null;
  if (!request.body) return '';
  const reader = request.clone().body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<null>(resolve => { timeout = setTimeout(() => resolve(null), 2500); });
  const read = async () => {
    while (true) {
      const next = await reader.read();
      if (next.done) return new TextDecoder().decode(Buffer.concat(chunks));
      size += next.value.byteLength;
      if (size > MAX_CHECKOUT_BODY_BYTES) return null;
      chunks.push(next.value);
    }
  };
  try { return await Promise.race([read(), expired]); }
  catch { return null; }
  finally { clearTimeout(timeout); void reader.cancel().catch(() => {}); }
}

/** Server-cart forms dispatch Commerce internally, so enforce the merchant boundary on the outer POST.
 * Commerce and the route parser still own cart versions, capabilities, contact and price validation.
 */
export async function admitMerchantServerCart(request: Request, path: string, take?: Take): Promise<Response | null> {
  if (!merchantServerCartMutationPath(path)) return refusal(403, 'CHECKOUT_UNAVAILABLE', 'Checkout route unavailable.');
  if (request.method !== 'POST') return refusal(405, 'METHOD_NOT_ALLOWED', 'Checkout requires POST.');
  if (new URL(request.url).origin !== ORIGIN || request.headers.get('origin') !== ORIGIN ||
      ![null, 'same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) {
    return refusal(403, 'ORIGIN_DENIED', 'Open checkout on backroadbum.com and try again.');
  }
  const contentType = request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  const accepted = ['application/x-www-form-urlencoded', 'multipart/form-data', ...(path.endsWith('.js') ? ['application/json'] : [])];
  if (!contentType || !accepted.includes(contentType)) return refusal(415, 'INVALID_CART', 'Use the store cart form.');
  const peer = request.headers.get(MERCHANT_PEER_HEADER);
  if (!peer) return refusal(503, 'CHECKOUT_UNAVAILABLE', 'Checkout could not verify your connection. Try again later.');
  if (await boundedBody(request) === null) return refusal(413, 'INVALID_CART', 'Checkout request is too large or took too long.');
  try {
    const action = path === '/checkout' ? 'start' : 'prepare';
    const limit = take ?? (await import('./merchant-limits.server.js')).merchantLimits().take;
    const outcome = limit(action, peer);
    if (!outcome.allowed) return refusal(429, 'CHECKOUT_LIMITED', 'This demo has reached its checkout request limit. Keep your cart and try again in a few minutes.', outcome.retryAfter);
  } catch {
    return refusal(503, 'CHECKOUT_UNAVAILABLE', 'Checkout is temporarily unavailable. Your cart is saved.');
  }
  return null;
}

/** Host-only admission before Commerce dispatch, never a substitute for a guest capability or paid proof.
 * Only Caddy can reach the loopback Node listener from the public network; it overwrites MERCHANT_PEER_HEADER.
 */
export async function admitMerchantCheckout(request: Request, path: string, take?: Take): Promise<Response | null> {
  if (path.endsWith('/readiness')) return request.method === 'GET' ? null : refusal(405, 'METHOD_NOT_ALLOWED', 'Readiness requires GET.');
  const action = path === '/api/checkout/status' ? 'status' : path.split('/').at(-1);
  if (action !== 'prepare' && action !== 'start' && action !== 'status') return refusal(403, 'CHECKOUT_UNAVAILABLE', 'Checkout route unavailable.');
  if (request.method !== 'POST') return refusal(405, 'METHOD_NOT_ALLOWED', 'Checkout requires POST.');
  if (new URL(request.url).origin !== ORIGIN || request.headers.get('origin') !== ORIGIN ||
      ![null, 'same-origin', 'none'].includes(request.headers.get('sec-fetch-site'))) {
    return refusal(403, 'ORIGIN_DENIED', 'Open checkout on backroadbum.com and try again.');
  }
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    return refusal(415, 'INVALID_CART', 'Checkout requires JSON.');
  }
  const peer = request.headers.get(MERCHANT_PEER_HEADER);
  if (!peer) return refusal(503, 'CHECKOUT_UNAVAILABLE', 'Checkout could not verify your connection. Try again later.');
  const body = await boundedBody(request);
  if (body === null) return refusal(413, 'INVALID_CART', 'Checkout request is too large or took too long.');
  // Legacy status is a read-only merchant recovery wrapper, not the removed native status API.
  const valid = action === 'status' ? (() => {
    try { const value = JSON.parse(body); return value && typeof value === 'object' && !Array.isArray(value) &&
      Object.keys(value).every(key => key === 'attemptId') &&
      (value.attemptId === undefined || typeof value.attemptId === 'string'); } catch { return false; }
  })() : action === 'start' && validateCheckoutBody('start', body).ok;
  if (!valid) return refusal(400, 'INVALID_CART', 'Check your checkout details and try again.');
  try {
    const limit = take ?? (await import('./merchant-limits.server.js')).merchantLimits().take;
    const outcome = limit(action, peer);
    if (!outcome.allowed) return refusal(429, 'CHECKOUT_LIMITED', 'This demo has reached its checkout request limit. Keep your cart and try again in a few minutes.', outcome.retryAfter);
  } catch {
    return refusal(503, 'CHECKOUT_UNAVAILABLE', 'Checkout is temporarily unavailable. Your cart is saved in this browser.');
  }
  return null;
}
