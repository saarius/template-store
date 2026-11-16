import { readCommerceCatalogSnapshots } from '../commerce-catalog/index.js';
import type { InstalledCatalogContext } from '../commerce-catalog/installed.js';
import { projectGuestCartCatalogSnapshots } from './present.js';
import { isSafeOrderLineImageUrl, type GuestCheckoutProjection } from './checkout-protocol.js';

/** Optional current public artwork, never a replacement for the frozen purchase facts.
 * Call only with a validated, capability-authorized checkout. Missing/unpublished
 * media and a failed catalog read leave the paid receipt useful without a photo.
 */
export async function withReceiptCatalogMedia(
  checkout: GuestCheckoutProjection,
  context: InstalledCatalogContext,
): Promise<GuestCheckoutProjection> {
  const order = checkout.state === 'paid' ? checkout.order : null;
  if (!order) return checkout;
  const missing = [...new Set(order.lines.filter(line => !isSafeOrderLineImageUrl(line.imageUrl)).map(line => line.id))];
  if (!missing.length) return checkout;
  try {
    const snapshots = projectGuestCartCatalogSnapshots(await readCommerceCatalogSnapshots(missing, context));
    if (!snapshots) return checkout;
    const byId = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
    const enriched = { ...checkout, order: { ...order, lines: order.lines.map(line => {
      if (isSafeOrderLineImageUrl(line.imageUrl)) return line;
      const snapshot = byId.get(line.id);
      return snapshot?.found && snapshot.thumbnail
        ? { ...line, imageUrl: snapshot.thumbnail.src, imageAlt: snapshot.thumbnail.alt }
        : line;
    }) } };
    // The status transport accepts 64 KiB, including its result envelope.
    // Optional artwork may not push an otherwise useful receipt over that cap.
    return new TextEncoder().encode(JSON.stringify(enriched)).byteLength <= 60 * 1024 ? enriched : checkout;
  } catch {
    return checkout;
  }
}
