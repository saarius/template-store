import { describe, expect, it } from 'vitest';
import { summarizeReadinessCache } from '../../scripts/inspect-backroadbum-readiness.mjs';

const now = new Date('2026-11-12T15:40:00Z');
const at = now.getTime() / 1000 - 500;
const value = { version: 1, generation: 'private-settings-revisions', status: 'supported',
  lastAttemptAt: at, expiresAt: at + 900, attempts: [at - 1000, at] };

describe('read-only readiness metadata boundary', () => {
  it('retains only recognized timestamps, counts and cache status', () => {
    const result = summarizeReadinessCache(value, now);
    expect(result).toEqual({ schema: 'backroadbum.readiness-cache-inspection/v1',
      checkedAt: now.toISOString(), state: 'recognized', cachedStatus: 'supported', freshAtInspection: true,
      lastAttemptAt: '2026-11-12T15:31:40.000Z', expiresAt: '2026-11-12T15:46:40.000Z',
      retainedAttemptCount: 2, retainedAttemptTimes: ['2026-11-12T15:15:00.000Z', '2026-11-12T15:31:40.000Z'] });
    expect(JSON.stringify(result)).not.toContain('private');
  });
  it('distinguishes expired and unavailable cached states without claiming payment outcomes', () => {
    expect(summarizeReadinessCache(value, new Date(now.getTime() + 500000)))
      .toMatchObject({ state: 'recognized', cachedStatus: 'supported', freshAtInspection: false });
    expect(summarizeReadinessCache({ ...value, status: 'unavailable' }, now))
      .toMatchObject({ state: 'recognized', cachedStatus: 'unavailable' });
  });
  it.each([null, [], {}, { ...value, extra: 'private' }, { ...value, status: 'live' },
    { ...value, generation: '' }, { ...value, expiresAt: at + 901 },
    { ...value, attempts: [at + 1] }, { ...value, attempts: Array(101).fill(at) },
    { ...value, lastAttemptAt: at + 1000 }, { ...value, attempts: ['private'] }])
  ('refuses unrecognized cache values without echoing them', input => {
    expect(summarizeReadinessCache(input, now)).toEqual({ schema: 'backroadbum.readiness-cache-inspection/v1',
      checkedAt: now.toISOString(), state: 'unavailable' });
  });
});
