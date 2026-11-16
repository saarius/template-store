// Admission for the local, read-only Orders keyboard inspector; not a store policy.
const STORE = 'https://backroadbum.com';
const ADMIN = '/_emdash/api/plugins/r_gshdrqaldna3r7sn/admin';
export function orderNavigationRequestAllowed(url, method, body) {
  let target;
  try { target = new URL(url); } catch { return false; }
  if (target.origin !== STORE) return false;
  if (method === 'GET' || method === 'HEAD') return true;
  if (method !== 'POST') return false;
  // Native staff passkey sign-in is separate from shopper OTP/checkout.
  if (target.pathname.startsWith('/_emdash/api/auth/')) return true;
  if (target.pathname !== ADMIN) return false;
  const input = body?.input ?? body;
  if (!input || input.page !== '/orders') return false;
  if (input.type === 'page_load') return true;
  return input.type === 'block_action' && typeof input.action_id === 'string' &&
    (input.action_id === 'orders.list' || /^orders\.open:[^\s\u0000-\u001f]{1,512}$/u.test(input.action_id));
}

export function readOrderNavigationArgs(args) {
  if (!args.length) return null;
  if (args.length > 2 || args.filter(arg => arg === '--check').length !== 1 || args.some(arg => arg !== '--check' && !/^--order=[1-9]\d{0,8}$/u.test(arg))) {
    throw new Error('Use --check [--order=1010]');
  }
  return { order: Number(args.find(arg => arg.startsWith('--order='))?.slice(8) ?? 1010) };
}
