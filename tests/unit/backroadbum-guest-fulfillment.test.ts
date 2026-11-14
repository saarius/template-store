import { describe, expect, it } from 'vitest';
import { summarizeGuestFulfillment } from '../../scripts/lib/backroadbum-guest-fulfillment.mjs';

const guest = { paid: true, orderId: 'order:synthetic', fulfillmentPresent: false, completionPresent: false, statusPresent: false };
const record = { paidOrder: { orderId: 'order:synthetic', mode: 'test', contactSnapshot: { email: 'private@example.test' } },
  completed: { at: '2026-11-14T00:00:00Z', carrier: 'Synthetic carrier', tracking: 'private-tracking' } };

describe('operator guest fulfillment comparison', () => {
  it('joins the actual guest order and emits only states and presence flags', () => {
    const result = summarizeGuestFulfillment(guest, [record]);
    expect(result).toEqual({ sameCanonicalTestOrder: true, canonicalStatus: 'completed', canonicalCarrierPresent: true,
      canonicalTrackingPresent: true, guestFulfillmentPresent: false, guestCompletionPresent: false, guestStatusPresent: false });
    expect(JSON.stringify(result)).not.toMatch(/synthetic|private|carrier|tracking/u);
  });
  it('distinguishes Processing, optional tracking and present guest fields', () => {
    expect(summarizeGuestFulfillment(guest, [{ paidOrder: record.paidOrder }])).toMatchObject({ canonicalStatus: 'processing', canonicalTrackingPresent: false });
    expect(summarizeGuestFulfillment({ ...guest, fulfillmentPresent: true, completionPresent: true, statusPresent: true },
      [{ ...record, completed: { carrier: ' ', tracking: '' } }])).toMatchObject({ canonicalStatus: 'completed', canonicalCarrierPresent: false,
        canonicalTrackingPresent: false, guestFulfillmentPresent: true, guestCompletionPresent: true, guestStatusPresent: true });
  });
  it.each([null, {}, { ...guest, paid: false }, { ...guest, orderId: '' }])('refuses a missing or unpaid guest order', input => {
    expect(() => summarizeGuestFulfillment(input, [record])).toThrow('Paid guest order required');
  });
  it.each([[], [{ ...record, paidOrder: { ...record.paidOrder, orderId: 'foreign' } }], [record, record],
    [{ ...record, paidOrder: { ...record.paidOrder, mode: 'live' } }]].map(records => ({ records })))('refuses missing, foreign, duplicate or non-test canonical records', ({ records }) => {
    expect(() => summarizeGuestFulfillment(guest, records)).toThrow('One matching canonical TEST order required');
  });
});
