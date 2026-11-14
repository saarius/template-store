// Operator-only comparison. A paid guest response chooses the order to inspect;
// it grants no new shopper access. Return only fixed states and presence flags.
export function summarizeGuestFulfillment(guest, records) {
  if (guest?.paid !== true || typeof guest.orderId !== 'string' || !guest.orderId) {
    throw new Error('Paid guest order required');
  }
  const matches = records.filter(record => record?.paidOrder?.orderId === guest.orderId);
  if (matches.length !== 1 || matches[0].paidOrder.mode !== 'test') {
    throw new Error('One matching canonical TEST order required');
  }
  const record = matches[0];
  return {
    sameCanonicalTestOrder: true,
    canonicalStatus: record.completed ? 'completed' : 'processing',
    canonicalCarrierPresent: typeof record.completed?.carrier === 'string' && Boolean(record.completed.carrier.trim()),
    canonicalTrackingPresent: typeof record.completed?.tracking === 'string' && Boolean(record.completed.tracking.trim()),
    guestFulfillmentPresent: guest.fulfillmentPresent === true,
    guestCompletionPresent: guest.completionPresent === true,
    guestStatusPresent: guest.statusPresent === true,
  };
}
