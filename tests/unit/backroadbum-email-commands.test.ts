import { describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe('operator email actions are explicit', () => {
  it.each(['verify-backroadbum-email-delivery.mjs', 'verify-backroadbum-shopper-email.mjs'])('%s has no action by default or on import', name => {
    const script = new URL(`../../scripts/${name}`, import.meta.url);
    expect(execFileSync(process.execPath, [fileURLToPath(script)], { encoding: 'utf8' })).toMatch(/^No action\./);
    expect(execFileSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(script.href)})`], { encoding: 'utf8' })).toBe('');
    const refused = spawnSync(process.execPath, [fileURLToPath(script), '--send-anywhere'], { encoding: 'utf8' });
    expect(refused.status).toBe(1);
    expect(refused.stderr).toMatch(/No action taken/);
    expect(refused.stderr).not.toMatch(/Bearer|password|secret/);
  });
});
