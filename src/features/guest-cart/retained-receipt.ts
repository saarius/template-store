import {
  callGuestCheckout, GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY, readGuestCheckoutRetention,
  type GuestCheckoutTransport,
} from './checkout-protocol.js';
import { confirmedOrderView, type ConfirmedOrderView } from './order-view.js';

// Merchant upgrade bridge only. It can read the original capability, never mint,
// replace, settle or start one, and never transfer it into the new cart cookie.
type StorageReader = Pick<Storage, 'getItem'>;
export type RetainedReceipt =
  | { kind: 'paid'; order: ConfirmedOrderView }
  | { kind: 'missing' | 'unavailable' | 'changed' | 'unconfirmed' };

export async function readRetainedReceipt(storage: StorageReader | null, transport: GuestCheckoutTransport): Promise<RetainedReceipt> {
  let raw: string | null;
  try { raw = storage?.getItem(GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY) ?? null; }
  catch { return { kind: 'unavailable' }; }
  if (!raw) return { kind: 'missing' };
  // Parse a snapshot. A response from an old tab may not authorize the current
  // browser state after another tab changes/removes the saved checkout.
  const retention = readGuestCheckoutRetention({ getItem: () => raw });
  if (!retention) return { kind: 'unavailable' };
  const { result, failure } = await callGuestCheckout(
    { kind: 'status', ...(retention.attemptId ? { attemptId: retention.attemptId } : {}) }, retention,
    { fetch: async (input, init) => {
      const response = await transport.fetch(input, init);
      if (!response.ok) throw new Error('Retained receipt read refused.');
      return response;
    } },
  );
  try {
    if (storage?.getItem(GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY) !== raw) return { kind: 'changed' };
  } catch { return { kind: 'changed' }; }
  if (failure || !result?.ok) return { kind: 'unavailable' };
  const order = confirmedOrderView(result.checkout);
  return order ? { kind: 'paid', order } : { kind: 'unconfirmed' };
}

export const retainedReceiptMessage = {
  paid: 'Order confirmed. This is your earlier checkout; your current cart is unchanged.',
  missing: 'No earlier checkout is saved in this browser. Use the browser you originally checked out with, or check your confirmation email.',
  unavailable: 'We could not read your earlier checkout just now. Keep this browser’s site data and try again, or contact the store.',
  changed: 'Your saved checkout changed in another tab. Check again to read the currently saved checkout.',
  unconfirmed: 'This earlier payment is not confirmed. This check has not started or replaced a payment. Keep this browser’s site data; check again or contact the store before trying to pay again.',
} as const;

function text(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

/** All receipt facts are text nodes from the validated, capability-authorized view. */
export function drawRetainedReceipt(root: HTMLElement, order: ConfirmedOrderView): void {
  const heading = text('div', '', 'guest-checkout-order-heading');
  heading.append(text('h2', `Order ${order.orderNumber}`));
  if (order.test) heading.append(text('span', 'TEST', 'guest-checkout-test-badge'));
  const items = document.createElement('ul');
  items.dataset.guestCheckoutOrderItems = '';
  for (const line of order.lines) {
    const row = text('li', '', 'guest-checkout-item');
    if (line.thumbnail) {
      const image = document.createElement('img');
      image.className = 'guest-checkout-item-thumb'; image.src = line.thumbnail.src; image.alt = line.thumbnail.alt;
      image.width = image.height = 56; row.append(image);
    } else row.append(text('span', 'No image', 'guest-checkout-item-thumb guest-checkout-item-thumb--placeholder'));
    const details = text('span', line.text, 'guest-checkout-item-details');
    if (line.variant) details.append(text('small', line.variant, 'guest-checkout-item-variant'));
    row.append(details, text('span', line.amount, 'guest-checkout-item-amount')); items.append(row);
  }
  const totals = document.createElement('dl'); totals.dataset.guestCheckoutOrderTotals = '';
  for (const row of order.totals) {
    const group = text('div', '', row.label === 'Total' ? 'total' : undefined);
    group.append(text('dt', row.label), text('dd', row.amount)); totals.append(group);
  }
  const destination = text('section', '', 'guest-checkout-destination');
  const details = [order.email, order.recipient, order.address, order.billingAddress && `Billing: ${order.billingAddress}`, order.shippingMethod].filter((value): value is string => Boolean(value));
  if (details.length) destination.append(text('h3', 'Shipping & confirmation details'), ...details.map(value => text('p', value)));
  const fulfillment = text('section', '', 'guest-checkout-fulfillment');
  if (order.fulfillment) fulfillment.append(text('h3', 'Order status'), text('p', order.fulfillment.status),
    ...(order.fulfillment.carrier ? [text('p', `Carrier: ${order.fulfillment.carrier}`)] : []),
    ...(order.fulfillment.tracking ? [text('p', `Tracking number: ${order.fulfillment.tracking}`)] : []));
  const keep = text('section', '', 'guest-checkout-keep');
  keep.append(text('h3', 'Keep your receipt'), text('p', 'Use your browser’s Print or Save as PDF command. Keep this browser’s site data to read this earlier checkout again.'));
  root.replaceChildren(heading, text('h3', 'Items'), items, totals, ...(details.length ? [destination] : []), ...(order.fulfillment ? [fulfillment] : []), keep);
  root.hidden = false;
}

export function hydrateRetainedReceipt(): void {
  const root = document.querySelector<HTMLElement>('[data-retained-receipt]');
  const button = root?.querySelector<HTMLButtonElement>('[data-retained-check]');
  const status = root?.querySelector<HTMLElement>('[data-retained-status]');
  const receipt = root?.querySelector<HTMLElement>('[data-retained-order]');
  if (!root || !button || !status || !receipt || root.dataset.bound) return;
  root.dataset.bound = 'true'; button.hidden = false;
  let checking = false;
  let generation = 0;
  const clear = () => { generation++; receipt.replaceChildren(); receipt.hidden = true; };
  // Revoke an already-painted receipt too, not just responses still in flight.
  window.addEventListener('storage', event => {
    if (event.key !== null && event.key !== GUEST_CHECKOUT_CAPABILITY_STORAGE_KEY) return;
    clear(); status.textContent = retainedReceiptMessage.changed;
  });
  window.addEventListener('pageshow', event => { if (event.persisted) { clear(); status.textContent = 'Check this browser’s saved earlier checkout again.'; } });
  button.addEventListener('click', async () => {
    if (checking) return;
    clear(); const started = generation; checking = true; button.disabled = true; button.setAttribute('aria-busy', 'true');
    status.textContent = 'Checking your earlier checkout…';
    let storage: StorageReader | null = null;
    try { storage = window.localStorage; } catch { /* blocked storage cannot authorize */ }
    try {
      const result = await readRetainedReceipt(storage, { fetch: (input, init) => fetch(input, init) });
      if (generation !== started) return;
      status.textContent = retainedReceiptMessage[result.kind];
      if (result.kind === 'paid') drawRetainedReceipt(receipt, result.order);
    } catch { if (generation === started) status.textContent = retainedReceiptMessage.unavailable; }
    finally { checking = false; button.disabled = false; button.removeAttribute('aria-busy'); button.textContent = 'Check earlier checkout again'; }
  });
}
