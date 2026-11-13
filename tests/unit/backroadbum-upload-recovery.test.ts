import { describe, expect, it } from 'vitest';
import { uploadRecoverySummary } from '../../src/features/experiment-report/upload-recovery';

const receipt = {
  schema: 'backroadbum.upload-recovery-status/v1', state: 'verified', checkedAt: '2026-11-13T21:25:02+00:00',
  counts: { readyMediaVerified: 9, restoredUploadFiles: 15, nonReadyMediaNotVerified: 0,
    restoredUploadBytes: 550044, readyMediaBytesVerified: 346036 },
};

describe('latest archive media-check reporting', () => {
  it('names the scope, counts and dated observation without extra recovery claims', () => {
    expect(uploadRecoverySummary(receipt)).toBe('9 ready media files match archived sizes and hashes · 15 upload files restored · checked Nov 13, 2026, 21:25 UTC');
  });

  it('distinguishes non-ready rows from verified media', () => {
    const text = uploadRecoverySummary({ ...receipt, counts: { ...receipt.counts,
      readyMediaVerified: 1, restoredUploadFiles: 1, nonReadyMediaNotVerified: 1 } });
    expect(text).toContain('1 ready media file matches');
    expect(text).toContain('1 upload file restored · 1 non-ready media row not verified');
  });

  it.each([undefined, null, {}, { ...receipt, schema: 'wrong' }, { ...receipt, state: 'unavailable' },
    { ...receipt, checkedAt: 'private exception' }, { ...receipt, checkedAt: '2026-11-13' },
    { ...receipt, checkedAt: '2026-99-99T00:00:00Z' }, { ...receipt, counts: null },
    { ...receipt, counts: { ...receipt.counts, readyMediaVerified: true } },
    { ...receipt, counts: { ...receipt.counts, readyMediaVerified: -1 } },
    { ...receipt, counts: { ...receipt.counts, readyMediaVerified: 1.5 } },
    { ...receipt, counts: { ...receipt.counts, readyMediaVerified: 16 } },
    { ...receipt, counts: { ...receipt.counts, readyMediaBytesVerified: 550045 } },
    { ...receipt, counts: { ...receipt.counts, restoredUploadBytes: Infinity } },
  ])('keeps missing or malformed evidence unavailable: %j', (value) => {
    expect(uploadRecoverySummary(value)).toBe('Unavailable · no readable check for the latest archive');
  });

  it('does not inherit an older check for a changed archive', () => {
    expect(uploadRecoverySummary({ ...receipt, state: 'not-checked' }))
      .toBe('Not checked · no matching check for the latest archive');
  });

  it('reports no archive without implying zero failed recoveries', () => {
    expect(uploadRecoverySummary({ ...receipt, state: 'no-backup' }))
      .toBe('Unavailable · no local archive found');
  });

  it('reports refusal without exposing its private reason or stale passing counts', () => {
    const text = uploadRecoverySummary({ ...receipt, state: 'failed', error: 'private', archive: '/private/path' });
    expect(text).toBe('Offline media check failed · archive retained for investigation · checked Nov 13, 2026, 21:25 UTC');
    expect(text).not.toMatch(/private|9 ready/);
  });
});
