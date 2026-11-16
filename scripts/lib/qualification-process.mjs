/** Linux operator-only processes, bounded by a unique systemd scope.
 * Unlike a PID/process group, the scope retains sudo/session-detached descendants.
 * --scope runs locally and inherits the caller's existing network/mount namespaces.
 * Never target a pre-existing service or accept a unit name from CLI input.
 */
import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const owned = new WeakMap();
const pause = ms => new Promise(done => setTimeout(done, ms));
const UNIT = /^backroadbum-qualification-[a-f0-9-]{36}\.scope$/;

export function qualificationCommand({ file, args, env, uid, gid, unit }) {
  assert.match(unit, UNIT);
  assert.ok(Number.isSafeInteger(uid) && uid > 0 && Number.isSafeInteger(gid) && gid > 0, 'Run qualification as an unprivileged operator');
  assert.ok(typeof file === 'string' && file.length > 0 && !file.includes('\0'));
  assert.ok(Array.isArray(args) && args.every(x => typeof x === 'string' && !x.includes('\0')));
  assert.ok(env && typeof env.PATH === 'string' && typeof env.HOME === 'string', 'Supply a scrubbed environment explicitly');
  for (const [key, value] of Object.entries(env)) {
    assert.match(key, /^[A-Z_][A-Z0-9_]*$/i);
    assert.ok(!/SECRET|TOKEN|PASSWORD|CREDENTIAL|PRIVATE|(?:^|_)KEY(?:_|$)/i.test(key), 'Never place credentials in process arguments');
    assert.ok(typeof value === 'string' && !value.includes('\0'));
  }
  return ['sudo', ['-n', 'systemd-run', '--quiet', '--scope', '--collect', `--unit=${unit}`,
    '--property=TimeoutStopSec=2s', '--', 'setpriv', `--reuid=${uid}`, `--regid=${gid}`, '--init-groups',
    'env', '-i', ...Object.entries(env).map(([key, value]) => `${key}=${value}`), file, ...args]];
}

export function spawnQualificationProcess(file, args, options) {
  assert.equal(process.platform, 'linux');
  assert.ok(options && !options.shell);
  const unit = `backroadbum-qualification-${randomUUID()}.scope`;
  const [command, commandArgs] = qualificationCommand({ file, args, env: options.env, uid: process.getuid(), gid: process.getgid(), unit });
  const child = spawn(command, commandArgs, { ...options, detached: true });
  // Observe errors even when startup fails before a checker attaches an exit handler.
  child.on('error', () => {});
  owned.set(child, { unit, stopping: null });
  return child;
}

async function systemctl(args) {
  try {
    const { stdout } = await execute('sudo', ['-n', 'systemctl', ...args], { timeout: 8000, maxBuffer: 64 * 1024 });
    return stdout.trim();
  } catch { throw new Error('Qualification scope control failed'); }
}

export function stopQualificationProcess(child) {
  if (!child) return Promise.resolve();
  const state = owned.get(child);
  assert.ok(state && UNIT.test(state.unit), 'Refuse to stop a process not launched by this helper');
  if (state.stopping) return state.stopping;
  state.stopping = (async () => {
    // Registration is asynchronous. Do not declare cleanup finished just because
    // a just-spawned scope is not visible yet. Conversely, leader exit is NOT
    // proof of cleanup: an orphan can keep the scope alive after its parent exits.
    let active;
    for (let i = 0; i < 100; i++) {
      active = await systemctl(['show', '--property=ActiveState', '--value', state.unit]);
      if (!['inactive', 'failed'].includes(active) || child.exitCode !== null || child.signalCode !== null) break;
      await pause(50);
    }
    if (!['inactive', 'failed'].includes(active)) {
      // stop applies TimeoutStopSec to the entire cgroup, including descendants
      // in another session and children that ignore SIGTERM.
      await systemctl(['stop', state.unit]);
    }
    const after = await systemctl(['show', '--property=ActiveState', '--value', state.unit]);
    assert.ok(['inactive', 'failed'].includes(after), 'Qualification scope remains active');
    for (let i = 0; i < 100 && child.exitCode === null && child.signalCode === null; i++) await pause(20);
    assert.ok(child.exitCode !== null || child.signalCode !== null, 'Qualification launcher did not exit');
  })();
  return state.stopping;
}
