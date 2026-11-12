import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const launcher = new URL('./start-store.mjs', import.meta.url).href;
const fixture = fileURLToPath(new URL('./fixtures/node-store.mjs', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function request(port, path = '/') {
  return new Promise((resolve, reject) => {
    get({ hostname: '127.0.0.1', port, path, agent: false }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, text }));
      response.on('error', reject);
    }).on('error', reject);
  });
}
function start(t, scenario, { baseline = false, deadline = 8000, cli } = {}) {
  const args = cli ? [cli, fixture] : baseline ? [fixture] : ['--input-type=module', '--eval',
    `import { startStore } from ${JSON.stringify(launcher)}; await startStore(process.env.STORE_ENTRY, { shutdownMs: ${deadline} }).catch(() => { console.error('[store] Startup failed.'); process.exitCode = 1; });`];
  const child = spawn(process.execPath, args, {
    detached: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    env: { ...process.env, STORE_FIXTURE: scenario, STORE_ENTRY: fixture },
  });
  let output = '';
  const messages = [];
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  child.on('message', message => messages.push(message));
  const exited = once(child, 'exit');
  t.after(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} });
  return {
    child, exited, output: () => output,
    async message(kind) {
      for (let i = 0; i < 500; i++) {
        const found = messages.find(message => message.kind === kind);
        if (found) return found;
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Fixture exited: ${output}`);
        await sleep(10);
      }
      throw new Error(`Fixture did not send ${kind}: ${output}`);
    },
  };
}

test('CLI entry runs through the operations symlink', { timeout: 10000 }, async t => {
  const dir = await mkdtemp(join(tmpdir(), 'store-launcher-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const alias = join(dir, 'start-store.mjs');
  await symlink(fileURLToPath(launcher), alias);
  const app = start(t, 'constructor', { cli: alias });
  const { port } = await app.message('listening');
  assert.equal((await request(port)).status, 200);
  app.child.kill('SIGINT');
  assert.deepEqual(await app.exited, [0, null]);
  assert.match(app.output(), /HTTP drained/);
});

for (const scenario of ['none', 'constructor', 'worker']) {
  test(`SIGINT naturally exits with ${scenario}`, { timeout: 15000 }, async t => {
    const app = start(t, scenario);
    const { port, worker } = await app.message('listening');
    assert.equal((await request(port)).status, 200);
    const began = Date.now();
    app.child.kill('SIGINT');
    assert.deepEqual(await app.exited, [0, null]);
    assert.ok(Date.now() - began < 3000);
    assert.match(app.output(), /HTTP drained/);
    assert.doesNotMatch(app.output(), /deadline exceeded/);
    await assert.rejects(request(port));
    if (worker) assert.throws(() => process.kill(worker, 0), { code: 'ESRCH' });
  });
}

test('SIGINT drains an admitted real sandbox request before releasing workerd', { timeout: 15000 }, async t => {
  const app = start(t, 'worker');
  const { port, worker } = await app.message('listening');
  const response = request(port, '/slow');
  await app.message('entered');
  await sleep(100);
  app.child.kill('SIGINT');
  await sleep(40);
  // Repeated stops cannot forward SIGTERM early or reset the deadline.
  app.child.kill('SIGINT');
  assert.doesNotThrow(() => process.kill(worker, 0));
  await assert.rejects(request(port));
  assert.deepEqual(await response, { status: 200, text: '{"completed":true}' });
  assert.deepEqual(await app.exited, [0, null]);
  assert.throws(() => process.kill(worker, 0), { code: 'ESRCH' });
});

test('direct SIGTERM is bounded (no in-flight sandbox drain claim)', { timeout: 10000 }, async t => {
  const app = start(t, 'worker');
  await app.message('listening');
  app.child.kill('SIGTERM');
  assert.deepEqual(await app.exited, [0, null]);
});

for (const scenario of ['hung-request', 'lingering']) {
  test(`${scenario} reports failure at deadline, never successful drain`, { timeout: 10000 }, async t => {
    const app = start(t, scenario, { deadline: 250 });
    const { port } = await app.message('listening');
    const pending = scenario === 'hung-request' ? request(port, '/hang').catch(() => null) : null;
    if (pending) await app.message('entered');
    const began = Date.now();
    app.child.kill('SIGINT');
    assert.deepEqual(await app.exited, [1, null]);
    assert.ok(Date.now() - began >= 200 && Date.now() - began < 2000);
    assert.match(app.output(), /Shutdown deadline exceeded/);
    if (pending) {
      await pending;
      assert.doesNotMatch(app.output(), /HTTP drained/);
    }
  });
}

test('signal during import never opens a listener after stopping begins', { timeout: 10000 }, async t => {
  const app = start(t, 'startup-delay');
  await app.message('importing');
  app.child.kill('SIGINT');
  assert.deepEqual(await app.exited, [0, null]);
  assert.match(app.output(), /HTTP drained/);
});

test('startup failure is nonzero without serializing private errors', { timeout: 10000 }, async t => {
  const app = start(t, 'startup-failure');
  assert.deepEqual(await app.exited, [1, null]);
  assert.match(app.output(), /Startup failed/);
  assert.doesNotMatch(app.output(), /synthetic private error/);
});

test('unchanged standalone plus runner retains HTTP on SIGTERM', { timeout: 10000 }, async t => {
  const app = start(t, 'constructor', { baseline: true });
  const { port } = await app.message('listening');
  app.child.kill('SIGTERM');
  await sleep(300);
  assert.equal(app.child.exitCode, null);
  assert.deepEqual(await request(port), { status: 200, text: 'ok' });
});
