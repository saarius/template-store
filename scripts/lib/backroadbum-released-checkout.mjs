// Restore only an original guest capability and validated cart intent, never
// staff/shopper cookies, contact fields, other origins or appearance preferences.
import { receiptBrowserState, receiptOrigin } from './backroadbum-retained-receipt.mjs';
import { GUEST_CART_STORAGE_KEY, parseGuestCartIntent } from '../../src/features/guest-cart/intent.ts';

export function releasedCheckoutBrowserState(state) {
  const safe = receiptBrowserState(state);
  const origin = state.origins.find(entry => entry.origin === receiptOrigin);
  const entries = origin.localStorage.filter(entry => entry.name === GUEST_CART_STORAGE_KEY);
  if (entries.length !== 1 || typeof entries[0].value !== 'string' || entries[0].value.length > 8192 ||
      !parseGuestCartIntent(JSON.parse(entries[0].value))?.lines.length) {
    throw new Error('Original guest cart unavailable');
  }
  safe.origins[0].localStorage.push({ name: GUEST_CART_STORAGE_KEY, value: entries[0].value });
  return safe;
}
