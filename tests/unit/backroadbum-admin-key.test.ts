import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, statSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { persistAdminKey } from '../../scripts/backroadbum-admin.mjs';
const dirs: string[] = [];
afterEach(() => { for (const path of dirs.splice(0)) rmSync(path, { recursive: true, force: true }); });
function file() { const dir = mkdtempSync(join(tmpdir(), 'brb-admin-key-')); dirs.push(dir); return join(dir, 'key.json'); }
it('atomically preserves the updated operator counter in a private file', async () => {
  const path = file(); writeFileSync(path, JSON.stringify([{ signCount: 1 }]), { mode: 0o600 });
  const cdp = { send: async (command: string, args: unknown) => {
    expect(command).toBe('WebAuthn.getCredentials'); expect(args).toEqual({ authenticatorId: 'fixture' });
    return { credentials: [{ signCount: 2, credentialId: 'synthetic' }] };
  } };
  await persistAdminKey(cdp, 'fixture', path);
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual([{ signCount: 2, credentialId: 'synthetic' }]);
  expect(statSync(path).mode & 0o777).toBe(0o600); expect(existsSync(path + '.next')).toBe(false);
});
it('a missing authenticator or failed read cannot replace the last good state', async () => {
  const path = file(); writeFileSync(path, 'last-good', { mode: 0o600 });
  await expect(persistAdminKey({ send: async () => ({ credentials: [] }) }, 'fixture', path)).rejects.toThrow();
  await expect(persistAdminKey({ send: async () => { throw Error('unavailable'); } }, 'fixture', path)).rejects.toThrow();
  expect(readFileSync(path, 'utf8')).toBe('last-good'); expect(existsSync(path + '.next')).toBe(false);
});
