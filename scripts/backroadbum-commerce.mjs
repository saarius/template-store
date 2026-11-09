// Stage a checked merchant sandbox build at an immutable path before a store build.
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const source = resolve(root, '../commerce/dist/backroadbum');
const profile = JSON.parse(readFileSync(resolve(source, 'profile.json'), 'utf8'));
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex');
if (profile.profile !== 'backroadbum/merchant-test-v1' || profile.mode !== 'test' || profile.origin !== 'https://backroadbum.com' ||
    JSON.stringify(profile.allowedHosts) !== '["backroadbum.com"]' || !/^[a-f0-9]{64}$/.test(profile.sha256) ||
    digest(resolve(source, 'dist/sandbox/plugin.mjs')) !== profile.sha256) throw Error('merchant_artifact_refused');
const manifest = JSON.parse(readFileSync(resolve(source, 'dist/sandbox/manifest.json'), 'utf8'));
if (JSON.stringify(manifest.allowedHosts) !== '["backroadbum.com"]') throw Error('merchant_hosts_refused');
const target = resolve(root, '.artifacts/backroadbum-commerce', profile.sha256);
if (!existsSync(target)) {
  mkdirSync(resolve(target, '..'), { recursive: true });
  const stage = target + '.next'; rmSync(stage, { recursive: true, force: true });
  cpSync(source, stage, { recursive: true }); renameSync(stage, target);
}
if (digest(resolve(target, 'dist/sandbox/plugin.mjs')) !== profile.sha256) throw Error('immutable_merchant_artifact_mismatch');
console.log(target);
