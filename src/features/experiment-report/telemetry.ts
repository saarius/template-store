import { z } from 'astro/zod';

const timestamp = z.iso.datetime({ offset: true });
const text = z.string().nullable().optional();
const metric = z.number().nonnegative().nullable().optional();
const section = <T extends z.ZodType>(schema: T) => schema.nullish().catch(null);
const window = z.object({
  firstObservedAt: timestamp,
  lastObservedAt: timestamp,
  unavailableSamples: z.number().int().positive(),
  lastHttp: metric,
  endedAt: timestamp.nullish(),
  endingState: z.enum(['ready-advisory', 'admission-closed']).nullish(),
}).refine(value => Boolean(value.endedAt) === Boolean(value.endingState));

// A projection of the independently collected file, not a cast of JSON.parse.
// Invalid optional sections become unavailable; unknown/private fields are not
// copied into the view. Dates are checked before Intl.DateTimeFormat sees them.
const telemetrySchema = z.object({
  collectedAt: timestamp,
  backupAt: timestamp.nullish(),
  services: section(z.record(z.string(), z.string().nullable())),
  http: section(z.record(z.string(), z.number().nullable())),
  host: section(z.object({
    cpuPercent: metric, totalMiB: metric, usedMiB: metric,
    swapUsedMiB: metric, diskUsedGiB: metric, diskTotalGiB: metric,
  })),
  checkout: section(z.object({ state: text, admission: text, healthHttp: metric })),
  shopperAccounts: section(z.object({ state: text })),
  checkoutProbe: section(z.object({
    schema: z.literal('backroadbum.checkout-probe/v1'),
    outcome: z.string(), elapsedMs: metric,
  })),
  checkoutHistory: section(z.object({
    schema: z.literal('backroadbum.checkout-observations/v1'),
    since: timestamp,
    active: window.nullable(),
    recent: z.array(window),
    lastGap: z.object({ after: timestamp, before: timestamp }).nullish(),
  })),
  activity: section(z.object({
    schema: z.literal('backroadbum.activity/v1'),
    sessions: metric, cyclePrompts: metric, cyclesWithFinalResponse: metric,
    averagePromptToFinalSeconds: metric, compactions: metric,
    recordedModelSeconds: metric, usageRecords: metric,
    apiEquivalentUSD: metric,
    usageComplete: z.boolean().optional(), costComplete: z.boolean().optional(),
    controller: section(z.object({
      successfulRuns: metric, lastResult: text, lastCompletedAt: timestamp.nullish(),
    })),
    latestModel: section(z.object({ model: text, provider: text, reasoning: text })),
    tokens: section(z.object({
      input: metric, output: metric, cacheRead: metric, cacheWrite: metric,
      reasoning: metric, totalTokens: metric,
    })),
  })),
  // The existing recovery helper separately validates its own versioned shape.
  uploadRecovery: z.unknown().optional(),
});

export type DashboardTelemetry = z.infer<typeof telemetrySchema>;

export function parseTelemetry(input: unknown): DashboardTelemetry | null {
  const result = telemetrySchema.safeParse(input);
  return result.success ? result.data : null;
}

export function telemetryIsStale(status: DashboardTelemetry | null, now = Date.now()): boolean {
  if (!status || !Number.isFinite(now)) return true;
  const age = now - Date.parse(status.collectedAt);
  return !Number.isFinite(age) || age < 0 || age > 180_000;
}

export function observationTime(value: string | null | undefined): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit',
    minute: '2-digit', second: '2-digit', hour12: false,
    timeZone: 'UTC', timeZoneName: 'short',
  }).format(new Date(value));
}
