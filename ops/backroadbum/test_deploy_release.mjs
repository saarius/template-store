import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const workspace = fileURLToPath(new URL('../../../../', import.meta.url));
const oldId = '20261123T100000Z';
const newId = '20261123T120000Z';
const orphanId = '20261123T130000Z';
const entry = 'server/entry.mjs';
const fixtureApp = `
  import lane from 'fixture-version';
  export function startServer() {
    console.log('started:' + lane);
    return { done: Promise.resolve() };
  }
`;

function fixture(t, { legacy = false, fresh = false } = {}) {
  const root = mkdtempSync(join(workspace, '.brb-deploy-release-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const old = join(root, 'releases', oldId);
  const candidate = join(root, 'releases', newId);
  const orphan = join(root, 'releases', orphanId);
  const repo = join(root, 'build');
  const oldTree = join(root, 'previous-checkout/node_modules');
  const newTree = join(repo, 'node_modules');
  const current = join(root, 'current');
  const shared = join(root, 'node_modules');
  for (const [lane, tree] of [['old', oldTree], ['new', newTree]]) {
    mkdirSync(join(tree, 'fixture-version'), { recursive: true });
    writeFileSync(join(tree, 'fixture-version/index.js'), `module.exports = '${lane}';`);
  }
  mkdirSync(orphan, { recursive: true });
  if (!fresh) {
    mkdirSync(join(old, 'server'), { recursive: true });
    writeFileSync(join(old, entry), fixtureApp);
    symlinkSync(old, current);
    symlinkSync(oldTree, shared);
    if (!legacy) symlinkSync(oldTree, join(old, 'node_modules'));
  }
  writeFileSync(join(root, 'fixture-entry.mjs'), fixtureApp);
  const invoke = problem => spawnSync('bash', ['-c', `
    source "$1/deploy.sh"
    root_fixture=$2 launcher=$3 failure=$4
    restart_count=0
    git() { echo fixture; }
    build_release() {
      echo build
      mkdir "$1/server"
      if [[ "$failure" == build ]]; then return 71; fi
      if [[ "$failure" == missing-entry ]]; then return 0; fi
      cp "$root_fixture/fixture-entry.mjs" "$1/server/entry.mjs"
      if [[ "$failure" == existing-link ]]; then mkdir "$1/node_modules"; fi
    }
    snapshot_store() {
      echo backup
      [[ -L "$release/node_modules" ]] || return 72
      [[ "$failure" != backup ]]
    }
    restart_store() {
      restart_count=$((restart_count + 1))
      if [[ "$failure" == restart && "$restart_count" == 1 ]]; then return 73; fi
      "$NODE" "$launcher" "$root_fixture/current/server/entry.mjs"
    }
    stop_store() { echo stopped; }
    wait_for_store() {
      echo checked
      if [[ "$failure" == term && "$restart_count" == 1 ]]; then kill -TERM "$BASHPID"; fi
      if [[ "$failure" == never-healthy || ( "$failure" == health && "$restart_count" == 1 ) ]]; then return 1; fi
      return 0
    }
    deploy_release "$root_fixture" "$5" "$6"
  `, 'fixture', here, root, join(here, legacy ? 'start-store.mjs' : 'start-pinned-store.mjs'),
    problem, repo, newId], {
    encoding: 'utf8', timeout: 10000, env: { PATH: '/usr/bin:/bin', NODE: process.execPath },
  });
  return { invoke, current, shared, old, candidate, orphan, oldTree, newTree };
}

function checkRefusal(f, result, { retained = false } = {}) {
  assert.ifError(result.error);
  assert.notEqual(result.status, 0, result.stdout);
  assert.equal(readlinkSync(f.current), f.old);
  assert.equal(readlinkSync(f.shared), f.oldTree);
  assert.equal(existsSync(f.candidate), retained);
  assert.equal(existsSync(f.orphan), true);
}

test('deploy pairs a new bundle with its own tree; keeps actual previous and leaves legacy fallback alone', t => {
  const f = fixture(t);
  const result = f.invoke('');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^build\nbackup\nstarted:new\nchecked\nDeployed fixture at /);
  assert.equal(readlinkSync(f.current), f.candidate);
  assert.equal(readlinkSync(join(f.candidate, 'node_modules')), f.newTree);
  assert.equal(readlinkSync(join(f.old, 'node_modules')), f.oldTree);
  assert.equal(readlinkSync(f.shared), f.oldTree);
  assert.equal(existsSync(f.orphan), false);
});

for (const failure of ['build', 'missing-entry', 'existing-link', 'backup']) {
  test(`${failure} failure leaves the serving pair and retained releases alone`, t => {
    const f = fixture(t);
    const result = f.invoke(failure);
    checkRefusal(f, result);
    assert.doesNotMatch(result.stdout, /started:|checked/);
    if (failure !== 'backup') assert.doesNotMatch(result.stdout, /backup/);
  });
}

test('mutable alias instead of the build checkout dependency directory refuses before build', t => {
  const f = fixture(t);
  rmSync(f.newTree, { force: true, recursive: true });
  symlinkSync(f.oldTree, f.newTree);
  const result = f.invoke('');
  checkRefusal(f, result);
  assert.equal(result.stdout, '');
});

for (const failure of ['health', 'restart', 'term']) {
  test(`${failure} during promotion restores the previous pinned runtime and verifies it`, t => {
    const f = fixture(t);
    const result = f.invoke(failure);
    checkRefusal(f, result);
    if (failure === 'term') assert.equal(result.status, 143);
    assert.equal(result.stdout.includes('started:new'), failure !== 'restart');
    assert.match(result.stdout, /started:old\nchecked\n$/);
    assert.match(result.stderr, /Previous release restored and shop check passed/);
  });
}

test('legacy rollback still reads the original shared fallback when old has no local link', t => {
  const f = fixture(t, { legacy: true });
  const result = f.invoke('health');
  checkRefusal(f, result);
  assert.match(result.stdout, /started:new\nchecked\nstarted:old\nchecked\n$/);
});

test('failed rollback health is reported as requiring recovery, never as a restored store', t => {
  const f = fixture(t);
  const result = f.invoke('never-healthy');
  checkRefusal(f, result, { retained: true });
  assert.match(result.stderr, /operator recovery required/);
  assert.doesNotMatch(result.stderr, /shop check passed/);
});

test('failed first deploy stops before dropping the pointer; does not invent a shared dependency link', t => {
  const f = fixture(t, { fresh: true });
  const result = f.invoke('health');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /started:new\nchecked\nstopped\n$/);
  assert.equal(existsSync(f.current), false);
  assert.equal(existsSync(f.candidate), false);
  assert.equal(existsSync(f.shared), false);
});
