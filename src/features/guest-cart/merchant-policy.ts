/** Private merchant rollout gate, independent of advisory Payments readiness. */
export function merchantCheckoutClosed(env: Record<string, string | undefined> = process.env): boolean {
  return env.BACKROADBUM_MERCHANT_PROFILE === '1' && env.BACKROADBUM_CHECKOUT_ENABLED !== '1';
}

/** EmDash sets locals.user from its authenticated session, never request headers. */
export function merchantOperator(user: unknown): boolean {
  return Boolean(user && typeof user === 'object' && 'role' in user && user.role === 50);
}

/** A pause stops new checkouts, not capability-scoped recovery of an existing one.
 * This classification grants no access: request admission and Commerce still authorize status.
 */
export function merchantCheckoutStatusPath(path: string): boolean {
  return path === '/api/checkout/status' ||
    path === '/_emdash/api/plugins/r_gshdrqaldna3r7sn/checkout/guest/status';
}

export function merchantCheckoutPath(path: string): boolean {
  return merchantCheckoutStatusPath(path) ||
    /^\/_emdash\/api\/plugins\/r_gshdrqaldna3r7sn\/checkout\/guest\/(prepare|start|status|readiness)$/.test(path);
}
