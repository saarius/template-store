import type { APIRoute } from 'astro';
import { getDb } from 'emdash/runtime';
import { createKyselyAdapter } from '@emdash-cms/auth/adapters/kysely';
import { operatorCheckout } from '../../../features/guest-cart/operator-checkout.js';

/** Caddy additionally requires HTTP authentication for /api/operator/* on this host. */
export const ALL: APIRoute = async ({ request, locals, session, cookies }) => {
  let user: unknown = null;
  const candidate = (locals as { user?: { id?: unknown } }).user ??
    (cookies.has('astro-session') ? await session?.get<{ id?: unknown }>('user') : null);
  const id = candidate?.id;
  if (typeof id === 'string') {
    try {
      const current = await createKyselyAdapter(await getDb() as never).getUserById(id);
      user = current && !current.disabled ? current : null;
    } catch { /* fail closed */ }
  }
  const runtime = locals.emdash;
  return operatorCheckout(request, user, runtime?.handlePublicPluginApiRoute?.bind(runtime));
};
