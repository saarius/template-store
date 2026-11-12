// Request admission for the read-only operator shipment inspector, not a store policy.
export function shipmentInspectionRequestAllowed(url, method, body) {
  let target;
  try { target = new URL(url); } catch { return false; }
  if (method === 'GET' || method === 'HEAD') return true;
  if (['dinkuskit.com', 'ship.dinkuskit.com', 'payments.dinkuskit.com'].includes(target.hostname)) return false;
  if (target.origin !== 'https://backroadbum.com') return false;
  if (target.pathname.startsWith('/_emdash/api/plugins/')) {
    if (target.pathname !== '/_emdash/api/plugins/r_ehdlg5cxkb3ffqvr/admin') return false;
    const input = body?.input ?? body;
    return method === 'POST' && (input?.type === 'page_load' || (input?.type === 'block_action' && input.action_id === 'open'));
  }
  // Merchant authentication can POST; storefront checkout and all other app writes cannot.
  return method === 'POST' && target.pathname.startsWith('/_emdash/api/auth/');
}
