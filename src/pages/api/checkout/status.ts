import type { APIRoute } from "astro";

import {
  COMMERCE_REGISTRY_RUNTIME_ID,
  GUEST_CHECKOUT_CAPABILITY_HEADER,
  guestCheckoutWire,
  parseGuestCheckoutWireResult,
} from "../../../features/guest-cart/checkout-protocol.js";

import { canDispatchInstalledGuestCheckout } from "../../../features/guest-cart/checkout-admission.js";
import { playgroundCheckoutConfigured } from "../../../features/playground-checkout/index.js";
import {
  playgroundAttemptBelongsToVisitor,
  playgroundCheckoutBindingsFromLocals,
} from "../../../features/playground-checkout/binding-auth.js";

export const prerender = false;
const MAX_REQUEST_BYTES = 4 * 1024;
const MAX_DISCARD_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

type StatusFailureCode =
  | "CHECKOUT_UNAVAILABLE"
  | "CHECKOUT_STATUS_HOST_ORIGIN"
  | "CHECKOUT_STATUS_ORIGIN_DENIED"
  | "CHECKOUT_STATUS_CAPABILITY_DENIED"
  | "CHECKOUT_STATUS_NOT_FOUND"
  | "CHECKOUT_STATUS_UNAVAILABLE"
  | "CHECKOUT_STATUS_RESPONSE_INVALID";

function domainFailureCode(code: string): StatusFailureCode {
  switch (code) {
    case "ORIGIN_DENIED": return "CHECKOUT_STATUS_ORIGIN_DENIED";
    case "CAPABILITY_DENIED": return "CHECKOUT_STATUS_CAPABILITY_DENIED";
    case "CHECKOUT_NOT_FOUND": return "CHECKOUT_STATUS_NOT_FOUND";
    case "UNAVAILABLE":
    case "PAYMENTS_UNAVAILABLE": return "CHECKOUT_STATUS_UNAVAILABLE";
    default: return "CHECKOUT_UNAVAILABLE";
  }
}

function unavailable(status = 503, code: StatusFailureCode = "CHECKOUT_UNAVAILABLE"): Response {
  return Response.json(
    { ok: false, error: { code, message: "Checkout status unavailable." } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function boundedRequestText(request: Request): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) {
    await discardRequestBody(request);
    return null;
  }
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        // Drain instead of cancelling: cancelling a chunked request body mid-stream
        // makes workerd drop the connection, so the client sees a 500 "Network
        // connection lost" instead of our 413. Draining is capped at 64 KiB
        // (MAX_DISCARD_BYTES) so an oversized or endless body cannot hold the
        // Worker reading forever; past that cap we stop reading and still reply 413.
        while (size <= MAX_DISCARD_BYTES) {
          const extra = await reader.read();
          if (extra.done) break;
          size += extra.value.byteLength;
        }
        return null;
      }
      chunks.push(next.value);
    }
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function discardRequestBody(request: Request): Promise<void> {
  if (!request.body) return;
  const reader = request.body.getReader();
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return;
      size += next.value.byteLength;
      if (size > MAX_DISCARD_BYTES) {
        await reader.cancel();
        return;
      }
    }
  } catch {
    // The body may already be disconnected; the bounded response is still safe.
  } finally {
    reader.releaseLock();
  }
}

// Do not turn this proxy into a same-origin credential forwarder for foreign
// callers. The configured store origin is authority; request Host is not.
function trustedStatusOrigin(request: Request, env: Record<string, unknown>): string | null {
  try {
    const site = new URL(typeof env.EMDASH_SITE_URL === "string" ? env.EMDASH_SITE_URL : "");
    const origin = new URL(request.headers.get("origin") ?? "");
    const canonical = (url: URL) =>
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
    if (!canonical(site) || !canonical(origin) || origin.origin !== site.origin ||
        new URL(request.url).origin !== site.origin) return null;
    const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
    if (fetchSite !== undefined && fetchSite !== "same-origin") return null;
    return site.origin;
  } catch {
    return null;
  }
}

/**
 * Status recovery dispatches to the store's Commerce (on the playground, the visitor's own Registry build).
 * Capability and origin checks below still apply; a configured playground shows a terminal status only to
 * the visitor whose session started that payment.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const env = ((locals as { __playgroundEnv?: Record<string, unknown> } | undefined)?.__playgroundEnv ?? process.env);
  const requestBody = await boundedRequestText(request);
  if (requestBody === null) {
    return unavailable(413);
  }
  const capability = request.headers.get(GUEST_CHECKOUT_CAPABILITY_HEADER);
  if (!capability) {
    return unavailable(400);
  }
  const origin = trustedStatusOrigin(request, env);
  if (!origin) return unavailable(403, "CHECKOUT_STATUS_HOST_ORIGIN");
  const runtime = locals?.emdash;
  if (!runtime || typeof runtime.handlePublicPluginApiRoute !== "function") {
    return unavailable(503, "CHECKOUT_STATUS_UNAVAILABLE");
  }
  const isPlayground = Boolean((locals as { __playgroundDb?: unknown } | undefined)?.__playgroundDb);
  // Merchant-only, explicit upgrade staging. Never probe/fall back between routes:
  // the signed 0.8.0 store keeps status-v1 until a coordinated upgrade is qualified.
  const protocol = env.BACKROADBUM_RECOVERY_PROTOCOL ?? "status-v1";
  const cartRead = protocol === "cart-v1";
  if ((protocol !== "status-v1" && !cartRead) || (cartRead && (env.BACKROADBUM_MERCHANT_PROFILE !== "1" || isPlayground))) {
    return unavailable(503, "CHECKOUT_STATUS_UNAVAILABLE");
  }
  let expectedAttempt: string | undefined;
  if (cartRead) {
    // The new cart endpoint can also WRITE. This recovery wrapper must never
    // forward lines/version/key (or silently turn a malformed body into a read).
    try {
      const input: unknown = JSON.parse(requestBody);
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(key => key !== "attemptId")) return unavailable(400);
      const hint = (input as { attemptId?: unknown }).attemptId;
      if (hint !== undefined) {
        if (typeof hint !== "string" || !/^[A-Za-z0-9._~-]{1,256}$/u.test(hint)) return unavailable(400);
        expectedAttempt = hint;
      }
    } catch {
      return unavailable(400);
    }
  }
  try {
    const route = cartRead ? "checkout/guest/cart" : "checkout/guest/status";
    if (cartRead) {
      if (typeof runtime.getPluginRouteMeta === "function") {
        const metadata = runtime.getPluginRouteMeta(COMMERCE_REGISTRY_RUNTIME_ID, route);
        if (!metadata?.public || !metadata.methods?.some(method => method.toUpperCase() === "POST")) {
          return unavailable(503, "CHECKOUT_STATUS_UNAVAILABLE");
        }
      }
    } else if (!canDispatchInstalledGuestCheckout({ runtime, request }, { inStore: isPlayground })) {
      return unavailable(503, "CHECKOUT_STATUS_UNAVAILABLE");
    }
    const pluginId = COMMERCE_REGISTRY_RUNTIME_ID;
    const target = new URL(`/_emdash/api/plugins/${pluginId}/${route}`, origin);
    const dispatch = () => runtime.handlePublicPluginApiRoute(
      pluginId,
      "POST",
      route,
      new Request(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          origin,
          [GUEST_CHECKOUT_CAPABILITY_HEADER]: capability,
        },
        body: cartRead ? "{}" : requestBody,
        cache: "no-store",
      }),
    );
    const result = await dispatch();
    let parsed: unknown;
    try {
      const text = JSON.stringify(result);
      if (typeof text !== "string" || new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
        return unavailable(503, "CHECKOUT_STATUS_RESPONSE_INVALID");
      }
      parsed = JSON.parse(text);
    } catch {
      return unavailable(503, "CHECKOUT_STATUS_RESPONSE_INVALID");
    }
    const validated = parseGuestCheckoutWireResult(parsed);
    if (!validated) return unavailable(503, "CHECKOUT_STATUS_RESPONSE_INVALID");
    if (!validated.ok) return unavailable(503, domainFailureCode(validated.error.code));
    // Cart reads select the current attempt, unlike old status's locator. Refuse
    // a different attempt instead of relaying another checkout's receipt.
    if (expectedAttempt && validated.checkout.attemptId !== expectedAttempt) {
      return unavailable(503, "CHECKOUT_STATUS_NOT_FOUND");
    }
    const terminal = validated.checkout.state === "paid" || validated.checkout.order !== null;
    if (isPlayground && playgroundCheckoutConfigured(env) && terminal) {
      const sessionId = request.headers.get("cookie")?.match(/(?:^|;\s*)emdash_playground=([^;]+)/u)?.[1] ?? "";
      // Published by the middleware: the same persistent store checkout start wrote.
      const bindingStore = playgroundCheckoutBindingsFromLocals(locals);
      if (!validated.checkout.attemptId ||
          !(await playgroundAttemptBelongsToVisitor(validated.checkout.attemptId, sessionId, bindingStore, env))) {
        return unavailable(403, "CHECKOUT_STATUS_CAPABILITY_DENIED");
      }
    }
    return Response.json({
      ok: true,
      capabilityId: validated.capabilityId,
      checkout: guestCheckoutWire(validated.checkout),
    }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return unavailable(503, "CHECKOUT_STATUS_UNAVAILABLE");
  }
};
