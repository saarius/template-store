// Explicit merchant composition. Never changes the generic playground/Registry pin.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
export function checkedShipArtifact(source) {
  const profile = JSON.parse(readFileSync(resolve(source, 'profile.json'), 'utf8'));
  const backend = readFileSync(resolve(source, 'dist/plugin.mjs'));
  const manifestBytes = readFileSync(resolve(source, 'dist/manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (profile.profile !== 'backroadbum/ship-practice-v2' || profile.origin !== 'https://backroadbum.com' || profile.mode !== 'test' ||
      profile.commerceConnected !== false || profile.published !== false || !/^[a-f0-9]{64}$/.test(profile.sha256) ||
      createHash('sha256').update(backend).digest('hex') !== profile.sha256 || profile.bytes !== backend.length || backend.length >= 131072 ||
      createHash('sha256').update(backend).update(manifestBytes).digest('hex') !== profile.artifactSha256 ||
      JSON.stringify(manifest.capabilities) !== '["network:request"]' || JSON.stringify(manifest.storage) !== '{}' || JSON.stringify(manifest.hooks) !== '[]' ||
      JSON.stringify(profile.allowedHosts) !== '["backroadbum.com"]' || JSON.stringify(manifest.allowedHosts) !== '["backroadbum.com"]' ||
      !Array.isArray(manifest.routes) || manifest.routes.length !== 1 || manifest.routes[0]?.name !== 'admin' ||
      manifest.routes[0].public !== false || manifest.routes[0].permission !== 'plugins:manage' ||
      JSON.stringify(manifest.routes[0].methods) !== '["POST"]' || manifest.admin?.settingsSchema?.connection?.type !== 'secret') {
    throw Error('merchant_ship_artifact_refused');
  }
  return { profile, manifest };
}
export function stageShipArtifact(root) {
  const source = resolve(root, '../ship/dist/backroadbum');
  const { profile } = checkedShipArtifact(source);
  const target = resolve(root, '.artifacts/backroadbum-ship', profile.artifactSha256);
  if (!existsSync(target)) {
    mkdirSync(resolve(target, '..'), { recursive: true });
    const stage = target + '.next'; rmSync(stage, { recursive: true, force: true });
    cpSync(source, stage, { recursive: true }); renameSync(stage, target);
  }
  checkedShipArtifact(target); return target;
}
export function merchantShipDescriptor(env = process.env) {
  if (env.BACKROADBUM_MERCHANT_PROFILE !== '1') return null;
  if (!env.BACKROADBUM_SHIP_DIR) throw Error('merchant_ship_artifact_required');
  const source = resolve(env.BACKROADBUM_SHIP_DIR);
  const { manifest } = checkedShipArtifact(source);
  return { id: 'r_ehdlg5cxkb3ffqvr', version: manifest.version, format: 'standard', entrypoint: resolve(source, 'dist/plugin.mjs'),
    capabilities: manifest.capabilities, allowedHosts: manifest.allowedHosts, storage: manifest.storage, routes: manifest.routes,
    hooks: manifest.hooks, adminPages: manifest.admin?.pages ?? [], settingsSchema: manifest.admin?.settingsSchema };
}
