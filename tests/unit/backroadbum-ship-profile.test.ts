import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { checkedShipArtifact, merchantShipDescriptor } from '../../scripts/lib/backroadbum-ship.mjs';
const dirs: string[] = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const hash = (...data: (string | Buffer)[]) => { const digest = createHash('sha256'); for (const part of data) digest.update(part); return digest.digest('hex'); };
function artifact() {
  const dir = mkdtempSync(join(tmpdir(), 'brb-ship-profile-')); dirs.push(dir); mkdirSync(join(dir, 'dist'));
  const backend = 'export default {};';
  const manifest = { version: '0.3.1', capabilities: ['network:request'], allowedHosts: ['backroadbum.com'], storage: {}, hooks: [],
    routes: [{ name: 'admin', methods: ['POST'], public: false, permission: 'plugins:manage' }],
    admin: { settingsSchema: { connection: { type: 'secret' } }, pages: [{ path: '/shipping', label: 'Shipments' }] } };
  const profile = { profile: 'backroadbum/ship-packing-v1', origin: 'https://backroadbum.com', mode: 'test', commerceConnected: false,
    published: false, bytes: Buffer.byteLength(backend), sha256: hash(backend), artifactSha256: hash(backend, JSON.stringify(manifest)), allowedHosts: ['backroadbum.com'] };
  const save = () => { writeFileSync(join(dir, 'dist/plugin.mjs'), backend); writeFileSync(join(dir, 'dist/manifest.json'), JSON.stringify(manifest)); writeFileSync(join(dir, 'profile.json'), JSON.stringify(profile)); };
  save(); return { dir, backend, profile, manifest, save };
}
describe('merchant Ship composition', () => {
  it('leaves every generic store unchanged, but refuses an incomplete merchant build', () => {
    expect(merchantShipDescriptor({})).toBeNull();
    expect(merchantShipDescriptor({ BACKROADBUM_MERCHANT_PROFILE: '0' })).toBeNull();
    expect(() => merchantShipDescriptor({ BACKROADBUM_MERCHANT_PROFILE: '1' })).toThrow('artifact_required');
  });
  it('mounts only the checked private Ship sandbox under the existing installed identity', () => {
    const a = artifact(); const descriptor = merchantShipDescriptor({ BACKROADBUM_MERCHANT_PROFILE: '1', BACKROADBUM_SHIP_DIR: a.dir });
    if (!descriptor) throw Error('merchant descriptor missing');
    expect(descriptor.id).toBe('r_ehdlg5cxkb3ffqvr'); expect(descriptor.allowedHosts).toEqual(['backroadbum.com']);
    expect(descriptor.format).toBe('standard'); expect(descriptor.routes).toEqual(a.manifest.routes);
    expect(descriptor.settingsSchema.connection.type).toBe('secret'); expect(readFileSync(descriptor.entrypoint, 'utf8')).toBe(a.backend);
  });
  it('refuses altered bytes or manifest even if the other file is unchanged', () => {
    const a = artifact(); writeFileSync(join(a.dir, 'dist/plugin.mjs'), 'tampered'); expect(() => checkedShipArtifact(a.dir)).toThrow();
    a.save(); a.manifest.admin.pages[0].label = 'changed'; a.save(); expect(() => checkedShipArtifact(a.dir)).toThrow();
  });
  it('refuses live, shared-host, public/wider-route and plaintext-secret profiles even with matching hashes', () => {
    const mutations = [
      (a: ReturnType<typeof artifact>) => { a.profile.mode = 'live'; },
      (a: ReturnType<typeof artifact>) => { a.profile.published = true; },
      (a: ReturnType<typeof artifact>) => { a.profile.commerceConnected = true; },
      (a: ReturnType<typeof artifact>) => { a.manifest.allowedHosts.push('ship.dinkuskit.com'); },
      (a: ReturnType<typeof artifact>) => { a.manifest.routes[0].public = true; },
      (a: ReturnType<typeof artifact>) => { a.manifest.routes[0].permission = 'content:edit_any'; },
      (a: ReturnType<typeof artifact>) => { a.manifest.routes.push({ ...a.manifest.routes[0], name: 'orders' }); },
      (a: ReturnType<typeof artifact>) => { a.manifest.admin.settingsSchema.connection.type = 'string'; },
    ];
    for (const mutate of mutations) {
      const a = artifact(); mutate(a); a.profile.artifactSha256 = hash(a.backend, JSON.stringify(a.manifest)); a.save();
      expect(() => checkedShipArtifact(a.dir)).toThrow('artifact_refused');
    }
  });
});
