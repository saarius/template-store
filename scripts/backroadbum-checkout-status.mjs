// Reconcile an existing private operator proof through installed Commerce.
// Never prepares a cart, creates a payment session, submits a card or marks paid itself.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openAdmin } from './backroadbum-admin.mjs';
if (!process.argv.includes('--check')) {
  console.log('No action. --check reconciles the existing private operator checkout proof.');
  process.exit(0);
}
let admin;
try {
  const proof = JSON.parse(readFileSync('/etc/backroadbum/operator-checkout.json', 'utf8'));
  assert.equal(typeof proof.capability, 'string');
  assert.ok(proof.capability.length > 0 && proof.capability.length <= 16384);
  admin = await openAdmin(); await admin.signIn();
  const lookup = async () => {
    const response = await admin.page.request.post('https://backroadbum.com/api/operator/checkout', {
      headers: { Origin: 'https://backroadbum.com', 'X-EmDash-Request': '1' },
      data: { action: 'status', input: {}, capability: proof.capability },
    });
    const result = await response.json();
    assert.equal(response.status(), 200); assert.equal(result.success, true); assert.equal(result.data.ok, true);
    return result.data.checkout;
  };
  const checkout = await lookup();
  assert.equal(checkout.attemptId, proof.checkout.attemptId);
  if (checkout.state === 'paid') {
    assert.ok(checkout.order?.orderId); assert.ok(checkout.order?.receiptId);
    if (proof.paidCheckout) assert.equal(checkout.order.orderId, proof.paidCheckout.order.orderId);
    assert.deepEqual((await lookup()).order, checkout.order);
  }
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), state: checkout.state,
    paidOrderPresent: Boolean(checkout.order), receiptRecordPresent: Boolean(checkout.order?.receiptId),
    replayStable: checkout.state === 'paid' ? true : null,
    total: checkout.order?.total ?? null, shopperReceiptUiVerified: false }, null, 2));
} catch {
  console.error('Operator checkout reconciliation refused; no response body or credentials emitted.');
  process.exitCode = 1;
} finally {
  if (admin) { await admin.saveKey(); await admin.browser.close(); }
}
