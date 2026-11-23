import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, existsSync, readFileSync, readlinkSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConnection } from 'node:net';
import { qualificationCommand, spawnQualificationProcess, stopQualificationProcess } from '../scripts/lib/qualification-process.mjs';
import { isolatedServerCommand } from '../scripts/lib/storefront-https-proof.mjs';

const env = { PATH: '/opt/node/bin:/usr/local/bin:/usr/bin:/bin', HOME: '/home/agent' };
const input = { file: process.execPath, args: ['-e', 'process.exit(0)'], env, uid: 1000, gid: 1000,
  unit: 'backroadbum-qualification-11111111-1111-1111-1111-111111111111.scope' };
const pause = ms => new Promise(done => setTimeout(done, ms));

test('uses a unique scope, inherited namespaces, bounded cgroup stop and unprivileged scrubbed payload', () => {
  const [file, args] = qualificationCommand(input);
  assert.equal(file, 'sudo');
  assert.deepEqual(args.slice(0, 5), ['-n', 'systemd-run', '--quiet', '--scope', '--collect']);
  assert.ok(args.includes('--property=TimeoutStopSec=2s'));
  assert.ok(args.includes('--reuid=1000') && args.includes('--regid=1000'));
  assert.ok(args.indexOf('setpriv') < args.indexOf('env'));
  assert.ok(args.includes('PATH=' + env.PATH));
  assert.ok(!args.some(x => /--service|NetworkNamespacePath|PrivateNetwork/.test(x)));
});

test('refuses caller-selected service names, root payload and ambient/secret-bearing environment', () => {
  for (const changes of [{ unit: 'backroadbum.service' }, { unit: '../other.scope' }, { uid: 0 }, { gid: 0 },
    { env: undefined }, { env: { ...env, STRIPE_API_KEY: 'not-a-secret' } }, { args: ['bad\0argument'] }]) {
    assert.throws(() => qualificationCommand({ ...input, ...changes }));
  }
});

test('the armed retained/storefront checker uses managed scopes for servers and auditors', () => {
  const source = readFileSync(new URL('../scripts/qualify-backroadbum-installed-retained.mjs', import.meta.url), 'utf8');
  assert.match(source, /spawnQualificationProcess as spawn, stopQualificationProcess as stop/);
  assert.ok(!source.includes('process.kill('));
  assert.equal((source.match(/\bspawn\(/g) ?? []).length, 2);
  assert.match(source, /const \[file, args\] = isolatedServerCommand\(site, serverEnv,/);
  assert.doesNotMatch(source, /\.(?:screenshot|storageState|content|pdf)\s*\(/);
});

test('never stops a foreign process handle; missing process and repeated no-op are safe', async () => {
  await stopQualificationProcess(null);
  assert.throws(() => stopQualificationProcess({ pid: 1, exitCode: 0 }));
});

const integration = process.env.BACKROADBUM_TEST_PROCESS_SCOPE === '1';
const listenable = port => new Promise(resolve => {
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.on('connect', () => { socket.destroy(); resolve(true); });
  socket.on('error', () => resolve(false));
});

for (const orphan of [false, true]) test(`scope reaps root/session-detached TERM-ignoring listener; leader ${orphan ? 'exits first' : 'stays alive'}`, { skip: !integration, timeout: 20000 }, async () => {
  const site = mkdtempSync(join(tmpdir(), 'backroadbum-process-scope-'));
  const ready = join(site, 'ready.json');
  const descendant = `process.on('SIGTERM',()=>{});const fs=require('node:fs');const net=require('node:net');const server=net.createServer(s=>s.end());server.listen(0,'127.0.0.1',()=>{const path=${JSON.stringify(ready)};fs.writeFileSync(path+'.tmp',JSON.stringify({pid:process.pid,uid:process.getuid(),port:server.address().port,namespace:fs.readlinkSync('/proc/self/ns/net')}));fs.chmodSync(path+'.tmp',0o644);fs.renameSync(path+'.tmp',path);});`;
  const leader = `const {spawn}=require('node:child_process');const child=spawn('sudo',['-n','setsid',${JSON.stringify(process.execPath)},'-e',${JSON.stringify(descendant)}],{stdio:'ignore'});child.unref();${orphan ? 'setTimeout(()=>process.exit(0),300);' : "process.on('SIGTERM',()=>{});setInterval(()=>{},1000);"}`;
  const child = spawnQualificationProcess(process.execPath, ['-e', leader], { env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !existsSync(ready); i++) await pause(50);
    assert.ok(existsSync(ready), 'synthetic root descendant ready');
    const data = JSON.parse(readFileSync(ready));
    assert.equal(data.uid, 0, 'test genuinely exercises a privileged child');
    assert.equal(data.namespace, readlinkSync('/proc/self/ns/net'));
    assert.equal(await listenable(data.port), true);
    if (orphan) await pause(600);
    const started = Date.now();
    const first = stopQualificationProcess(child);
    assert.equal(stopQualificationProcess(child), first, 'concurrent stop shares one operation');
    await first;
    assert.ok(Date.now() - started < 10000, 'bounded teardown');
    assert.equal(await listenable(data.port), false, 'detached listener port released');
    // PID may remain briefly as an init-adopted zombie, but can no longer run.
    if (existsSync(`/proc/${data.pid}/stat`)) assert.equal(readFileSync(`/proc/${data.pid}/stat`, 'utf8').split(') ')[1][0], 'Z');
    await stopQualificationProcess(child);
  } finally {
    await stopQualificationProcess(child);
    rmSync(site, { recursive: true, force: true });
  }
});

test('the real nested-sudo/private-mount server command inherits isolation and is fully stopped', { skip: !integration, timeout: 15000 }, async () => {
  const site = mkdtempSync(join(tmpdir(), 'backroadbum-mount-scope-'));
  const entry = join(site, 'entry.cjs'), ready = join(site, 'ready.json');
  writeFileSync(entry, `const fs=require('fs'),net=require('net');process.on('SIGTERM',()=>{});const s=net.createServer(c=>c.end());s.listen(0,'127.0.0.1',()=>fs.writeFileSync(${JSON.stringify(ready)},JSON.stringify({uid:process.getuid(),port:s.address().port,namespace:fs.readlinkSync('/proc/self/ns/net'),databaseHidden:!fs.existsSync('/var/lib/backroadbum/content.db'),credentialsHidden:!fs.existsSync('/etc/backroadbum/stripe.env')})));`);
  const [file, args] = isolatedServerCommand(site, env, entry);
  const child = spawnQualificationProcess(file, args, { env, stdio: 'ignore' });
  try {
    for (let i = 0; i < 100 && !existsSync(ready); i++) await pause(50);
    assert.ok(existsSync(ready));
    const data = JSON.parse(readFileSync(ready));
    assert.equal(data.uid, process.getuid());
    assert.equal(data.namespace, readlinkSync('/proc/self/ns/net'));
    assert.equal(data.databaseHidden, true); assert.equal(data.credentialsHidden, true);
    assert.equal(await listenable(data.port), true);
    await stopQualificationProcess(child);
    assert.equal(await listenable(data.port), false);
  } finally {
    await stopQualificationProcess(child);
    rmSync(site, { recursive: true, force: true });
  }
});

test('immediate cancellation cannot race past scope registration', { skip: !integration, timeout: 15000 }, async () => {
  const child = spawnQualificationProcess(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { env, stdio: 'ignore' });
  await stopQualificationProcess(child);
  assert.ok(child.exitCode !== null || child.signalCode !== null);
});
