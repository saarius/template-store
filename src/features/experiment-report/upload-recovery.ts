/** Public-safe copy for the latest archive's offline media check, not runtime recovery. */
export function uploadRecoverySummary(value: unknown): string {
  const unavailable = 'Unavailable · no readable check for the latest archive';
  if (!value || typeof value !== 'object') return unavailable;
  const receipt = value as Record<string, unknown>;
  if (receipt.schema !== 'backroadbum.upload-recovery-status/v1') return unavailable;
  if (receipt.state === 'not-checked') return 'Not checked · no matching check for the latest archive';
  if (receipt.state === 'no-backup') return 'Unavailable · no local archive found';
  if (receipt.state !== 'failed' && receipt.state !== 'verified') return unavailable;
  if (typeof receipt.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(receipt.checkedAt)) return unavailable;
  const date = new Date(receipt.checkedAt);
  if (!Number.isFinite(date.getTime())) return unavailable;
  const time = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC', timeZoneName: 'short' }).format(date);
  if (receipt.state === 'failed') return `Offline media check failed · archive retained for investigation · checked ${time}`;
  if (!receipt.counts || typeof receipt.counts !== 'object') return unavailable;
  const counts = receipt.counts as Record<string, unknown>;
  const keys = ['readyMediaVerified', 'restoredUploadFiles', 'nonReadyMediaNotVerified', 'restoredUploadBytes', 'readyMediaBytesVerified'];
  if (keys.some(key => typeof counts[key] !== 'number' || !Number.isSafeInteger(counts[key]) || (counts[key] as number) < 0 || (counts[key] as number) > 512 * 1024 * 1024)) return unavailable;
  const media = counts.readyMediaVerified as number;
  const files = counts.restoredUploadFiles as number;
  const unfinished = counts.nonReadyMediaNotVerified as number;
  if (media > files || (counts.readyMediaBytesVerified as number) > (counts.restoredUploadBytes as number)) return unavailable;
  const number = (n: number) => new Intl.NumberFormat('en-US').format(n);
  return `${number(media)} ready media ${media === 1 ? 'file matches' : 'files match'} archived sizes and hashes · ${number(files)} upload ${files === 1 ? 'file' : 'files'} restored${unfinished ? ` · ${number(unfinished)} non-ready media ${unfinished === 1 ? 'row' : 'rows'} not verified` : ''} · checked ${time}`;
}
