import { describe, expect, it } from 'vitest';
import { observationTime, parseTelemetry, telemetryIsStale, trafficIsStale } from '../../src/features/experiment-report/telemetry';

const collectedAt = '2026-11-15T02:40:00Z';
const now = Date.parse(collectedAt);
const sample = {
  collectedAt,
  services: { backroadbum: 'active', caddy: 'active' },
  host: { usedMiB: 600, totalMiB: 1962 },
  checkoutProbe: { schema: 'backroadbum.checkout-probe/v1', outcome: 'ready-advisory', elapsedMs: 123 },
  checkoutHistory: {
    schema: 'backroadbum.checkout-observations/v1', since: collectedAt,
    active: null, recent: [], lastGap: null,
  },
  activity: {
    schema: 'backroadbum.activity/v1', sessions: 2, cyclePrompts: 3,
    usageComplete: true, tokens: { totalTokens: 100 },
  },
};

describe('public dashboard telemetry boundary', () => {
  it('preserves current collector fields and omits unrecognized data', () => {
    const result = parseTelemetry({ ...sample, privateExtra: 'not-for-the-view' });
    expect(result?.services?.backroadbum).toBe('active');
    expect(result?.host?.usedMiB).toBe(600);
    expect(result?.checkoutProbe?.outcome).toBe('ready-advisory');
    expect(result?.checkoutHistory?.recent).toEqual([]);
    expect(result?.activity?.tokens?.totalTokens).toBe(100);
    expect(result).not.toHaveProperty('privateExtra');
  });
  it.each([null, [], 'text', {}, { collectedAt: 'not-a-date' }])('refuses unreadable root %j', input => {
    expect(parseTelemetry(input)).toBeNull();
  });
  it('marks invalid optional sections unavailable without hiding healthy metrics', () => {
    const result = parseTelemetry({ ...sample,
      host: { usedMiB: '600' },
      checkoutHistory: { ...sample.checkoutHistory, recent: [{}] },
      activity: { ...sample.activity, schema: 'unrecognized/v2' },
    });
    expect(result?.services?.backroadbum).toBe('active');
    expect(result?.checkoutProbe?.outcome).toBe('ready-advisory');
    expect(result?.host).toBeNull();
    expect(result?.checkoutHistory).toBeNull();
    expect(result?.activity).toBeNull();
  });
  it('accepts absent metrics without turning them into zeros', () => {
    const result = parseTelemetry({ collectedAt, host: { usedMiB: null } });
    expect(result?.host?.usedMiB).toBeNull();
    expect(result?.host?.totalMiB).toBeUndefined();
    expect(result?.activity).toBeUndefined();
  });
  it.each([NaN, Infinity, -1])('refuses non-finite or negative metrics %s', usedMiB => {
    expect(parseTelemetry({ collectedAt, host: { usedMiB } })?.host).toBeNull();
  });
  it('checks observation dates and requires completion state and time together', () => {
    const window = { firstObservedAt: collectedAt, lastObservedAt: collectedAt, unavailableSamples: 1, lastHttp: 503 };
    const withWindow = (extra: object) => parseTelemetry({ ...sample,
      checkoutHistory: { ...sample.checkoutHistory, recent: [{ ...window, ...extra }] },
    });
    expect(withWindow({})?.checkoutHistory?.recent).toHaveLength(1);
    expect(withWindow({ endingState: 'ready-advisory', endedAt: collectedAt })?.checkoutHistory?.recent).toHaveLength(1);
    expect(withWindow({ firstObservedAt: 'bad' })?.checkoutHistory).toBeNull();
    expect(withWindow({ endingState: 'ready-advisory' })?.checkoutHistory).toBeNull();
    expect(withWindow({ endedAt: collectedAt })?.checkoutHistory).toBeNull();
  });
  it('never treats invalid or future sample time as a fresh advisory', () => {
    const result = parseTelemetry(sample);
    expect(telemetryIsStale(result, now)).toBe(false);
    expect(telemetryIsStale(result, now + 180_000)).toBe(false);
    expect(telemetryIsStale(result, now + 180_001)).toBe(true);
    expect(telemetryIsStale(result, now - 1)).toBe(true);
    expect(telemetryIsStale(null, now)).toBe(true);
    expect(telemetryIsStale(result, NaN)).toBe(true);
  });
  it('distinguishes an initialized zero from absent or stale traffic and strips private extras', () => {
    const traffic = { schema: 'backroadbum.traffic/v1', since: collectedAt, through: collectedAt,
      retentionDays: 90, today: 0, last7Days: 0, last30Days: 0, privateExtra: 'not-for-the-view' };
    const result = parseTelemetry({ ...sample, traffic });
    expect(result?.traffic?.last7Days).toBe(0);
    expect(result?.traffic).not.toHaveProperty('privateExtra');
    expect(trafficIsStale(result?.traffic, now)).toBe(false);
    expect(trafficIsStale(result?.traffic, now + 180_001)).toBe(true);
    expect(trafficIsStale(result?.traffic, now - 1)).toBe(true);
    expect(trafficIsStale(undefined, now)).toBe(true);
    expect(trafficIsStale(null, NaN)).toBe(true);
    for (const extra of [{ today: -1 }, { today: 1.5 }, { last7Days: '0' }, { today: 3, last7Days: 2 },
      { last7Days: 3, last30Days: 2 }, { retentionDays: 365 }, { schema: 'future' }, { since: '2099-01-01T00:00:00Z' }]) {
      expect(parseTelemetry({ ...sample, traffic: { ...traffic, ...extra } })?.traffic).toBeNull();
    }
  });
  it('formats UTC observation times without throwing on missing/bad dates', () => {
    expect(observationTime(collectedAt)).toContain('02:40:00');
    expect(observationTime(collectedAt)).toContain('UTC');
    for (const value of [null, undefined, '', 'bad']) expect(observationTime(value)).toBe('Unavailable');
  });
});
