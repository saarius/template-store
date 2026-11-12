// Synthetic credentials only. Never reads production files or makes a provider request.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { encryptPluginSetting, resolvePluginEncryptionKeys } from 'emdash';
import { inspectEmDashCopy, withRestoredEmDash } from './verify-emdash-recovery.mjs';

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'brb-emdash-fixture-'));
  try {
    const configuration = join(root, 'emdash.env');
    const raw = 'emdash_enc_v1_' + Buffer.alloc(32, 7).toString('base64url');
    await writeFile(configuration, `EMDASH_ENCRYPTION_KEY=${raw}\n`, { mode: 0o600 });
    const keys = await resolvePluginEncryptionKeys({ EMDASH_ENCRYPTION_KEY: raw });
    const database = join(root, 'content.db');
    await writeFile(database, '', { mode: 0o600 });
    const db = new DatabaseSync(database);
    db.exec('CREATE TABLE options (name TEXT PRIMARY KEY, value TEXT)');
    for (const plugin of ['fixture-commerce', 'fixture-payments', 'fixture-ship']) {
      const envelope = await encryptPluginSetting(plugin, 'connection', 'synthetic-connection', keys);
      db.prepare('INSERT INTO options VALUES (?, ?)').run(`plugin:${plugin}:settings:connection`, JSON.stringify(envelope));
    }
    db.prepare('INSERT INTO options VALUES (?, ?)').run('plugin:fixture-commerce:settings:display', JSON.stringify('public text'));
    db.close();
    await mkdir(join(root, 'uploads'));
    await run({ root, database, configuration });
  } finally { await rm(root, { recursive: true, force: true }); }
}

function snapshot(root, configuration) {
  const result = spawnSync('python3', ['-c', `
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('backup', sys.argv[1])
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
print(backup.snapshot(pathlib.Path(sys.argv[2]), emdash_config=pathlib.Path(sys.argv[3])))
`, fileURLToPath(new URL('./backup.py', import.meta.url)), root, configuration], { encoding: 'utf8', timeout: 60000 });
  assert.equal(result.status, 0, 'Synthetic snapshot must complete');
  return result.stdout.trim();
}

test('archived credentials decrypt through EmDash without the original key file or network', async () => {
  await fixture(async ({ root, database, configuration }) => {
    const before = await readFile(database);
    const archive = snapshot(root, configuration);
    await rm(configuration);
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw Error('test_network_forbidden'); };
    try {
      assert.deepEqual(await withRestoredEmDash(archive), {
        schema: 'backroadbum.emdash-recovery-check/v1', integrity: 'ok', encryptedSettings: 3,
        encryptedPlugins: 3, missingKeyRefused: true, decryption: 'ok', liveFilesReplaced: false,
        runtimeRestartTested: false, outboundRequests: 0,
      });
      assert.equal(calls, 0);
      assert.ok((await readFile(database)).equals(before), 'Original database must be byte-identical');
    } finally { globalThis.fetch = originalFetch; }
  });
});

test('authenticated ciphertext corruption fails rather than reporting recovery success', async () => {
  await fixture(async ({ root, database, configuration }) => {
    const db = new DatabaseSync(database);
    const row = db.prepare('SELECT name, value FROM options WHERE name LIKE ?').get('%:connection');
    const envelope = JSON.parse(row.value);
    const bytes = Buffer.from(envelope.ciphertext, 'base64url'); bytes[0] ^= 1;
    envelope.ciphertext = bytes.toString('base64url');
    db.prepare('UPDATE options SET value=? WHERE name=?').run(JSON.stringify(envelope), row.name); db.close();
    await assert.rejects(withRestoredEmDash(snapshot(root, configuration)), { code: 'PLUGIN_SETTING_DECRYPTION_FAILED' });
  });
});

test('wrong key and malformed envelopes fail the offline inspection', async () => {
  await fixture(async ({ database, configuration }) => {
    const original = await readFile(configuration);
    await writeFile(configuration, `EMDASH_ENCRYPTION_KEY=emdash_enc_v1_${Buffer.alloc(32, 8).toString('base64url')}\n`);
    await assert.rejects(inspectEmDashCopy(database, configuration), { code: 'PLUGIN_SETTING_ENCRYPTION_KEY_UNKNOWN' });
    await writeFile(configuration, original);
    const db = new DatabaseSync(database);
    db.prepare('UPDATE options SET value=? WHERE name LIKE ?').run(JSON.stringify({ $emdash: 'plugin-setting', v: 9 }), '%:connection'); db.close();
    await assert.rejects(inspectEmDashCopy(database, configuration), /recovery_envelope_refused/);
  });
});

test('public settings alone are not proof of encrypted credential recovery', async () => {
  await fixture(async ({ database, configuration }) => {
    const db = new DatabaseSync(database); db.exec("DELETE FROM options WHERE name LIKE '%:connection'"); db.close();
    await assert.rejects(inspectEmDashCopy(database, configuration), /recovery_no_encrypted_settings/);
  });
});
