import { COMMERCE_REGISTRY_RUNTIME_ID } from './checkout-protocol.js';
import { merchantOperator } from './merchant-policy.js';

type Dispatcher = (id: string, method: string, path: string, request: Request) => Promise<{ success: boolean; data?: unknown; error?: unknown; status?: number }>;
const origin = 'https://backroadbum.com';
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });

/** Operator-only proof adapter. Never creates a plugin context or owns checkout state. */
export async function operatorCheckout(request: Request, user: unknown, dispatch?: Dispatcher): Promise<Response> {
  if (!merchantOperator(user)) return json({ error: 'unauthorized' }, 401);
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (request.headers.get('origin') !== origin) return json({ error: 'origin_mismatch' }, 403);
  if (!dispatch) return json({ error: 'unavailable' }, 503);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: 'invalid_request' }, 400);
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const next = await reader.read(); if (next.done) break;
        size += next.value.length;
        if (size > 64 * 1024) return json({ error: 'request_too_large' }, 413);
        chunks.push(next.value);
      }
    } finally { void reader.cancel(); reader.releaseLock(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        Object.keys(body).some(key => !['action', 'input', 'capability'].includes(key)) ||
        !['prepare', 'start', 'status'].includes(body.action) || !body.input || typeof body.input !== 'object' || Array.isArray(body.input) ||
        body.capability !== undefined && (typeof body.capability !== 'string' || body.capability.length > 16384)) return json({ error: 'invalid_request' }, 400);
    const path = 'checkout/guest/' + body.action;
    const forwarded = new Request(`${origin}/_emdash/api/plugins/${COMMERCE_REGISTRY_RUNTIME_ID}/${path}`, {
      method: 'POST', headers: { origin, 'sec-fetch-site': 'same-origin', 'content-type': 'application/json',
        ...(body.capability ? { 'x-commerce-guest-capability': body.capability } : {}) }, body: JSON.stringify(body.input),
    });
    const result = await dispatch(COMMERCE_REGISTRY_RUNTIME_ID, 'POST', path, forwarded);
    return json(result, result.success ? 200 : result.status ?? 400);
  } catch { return json({ error: 'operator_checkout_unavailable' }, 503); }
}
