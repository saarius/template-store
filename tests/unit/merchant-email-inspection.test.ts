import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { summarizeEmailSettings } from '../../scripts/inspect-backroadbum-email.mjs';
const data = { available: false, providers: [], selectedProviderId: null, middleware: { beforeSend: [], afterSend: [] } };
const summarize = (value: unknown) => summarizeEmailSettings({ success: true, data: value });
describe('private native email inspection', () => {
  it('reports missing configuration without claiming delivery or an inspection failure', () => {
    expect(summarize(data)).toEqual({ state: 'not-configured', providerCount: 0, selectedProvider: false,
      middlewareCount: { beforeSend: 0, afterSend: 0 }, delivery: 'unverified' });
  });
  it('distinguishes installed-but-unselected from selected, without publishing provider identities or extra fields', () => {
    const providers = [{ pluginId: 'private-provider' }, { pluginId: 'other-provider' }];
    expect(summarize({ ...data, providers }).state).toBe('not-configured');
    const result = summarize({ ...data, providers, available: true, selectedProviderId: 'private-provider',
      middleware: { beforeSend: ['private-middleware'], afterSend: [] }, secret: 'do-not-publish' });
    expect(result).toEqual({ state: 'provider-selected', providerCount: 2, selectedProvider: true,
      middlewareCount: { beforeSend: 1, afterSend: 0 }, delivery: 'unverified' });
    expect(JSON.stringify(result)).not.toMatch(/private|do-not-publish|other-provider/);
  });
  it.each([
    null, {}, { ...data, available: 'false' }, { ...data, available: true },
    { ...data, providers: {} }, { ...data, providers: [null] },
    { ...data, providers: [{ pluginId: 'a' }, { pluginId: 'a' }] },
    { ...data, selectedProviderId: 'missing' },
    { ...data, middleware: { beforeSend: [], afterSend: null } },
    { ...data, available: false, providers: [{ pluginId: 'a' }], selectedProviderId: 'a' },
  ])('keeps malformed or contradictory observations unavailable: %j', value => {
    expect(summarize(value)).toEqual({ state: 'unavailable', delivery: 'unverified' });
  });
  it('does not accept an unsuccessful API envelope', () => {
    expect(summarizeEmailSettings({ success: false, data })).toEqual({ state: 'unavailable', delivery: 'unverified' });
  });
  it('has no browser/authentication action without an explicit check; invalid arguments fail', () => {
    const script = fileURLToPath(new URL('../../scripts/inspect-backroadbum-email.mjs', import.meta.url));
    expect(execFileSync(process.execPath, [script], { encoding: 'utf8' })).toMatch(/^No action\./);
    expect(spawnSync(process.execPath, [script, '--send'], { encoding: 'utf8' }).status).toBe(1);
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(new URL('../../scripts/inspect-backroadbum-email.mjs', import.meta.url).href)})`], { encoding: 'utf8' })).toBe('');
  });
});
