// Offline credential-recovery drill. Only a new temporary copy is opened; no server or provider calls.
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { decodePluginSettingValue, isEncryptedPluginSetting, resolvePluginEncryptionKeys } from 'emdash';

export async function inspectEmDashCopy(database, configuration) {
  const raw = await readFile(configuration, 'utf8');
  // The extractor has already validated and normalized this single allowlisted assignment.
  if (!/^EMDASH_ENCRYPTION_KEY=[^\r\n]+\n$/.test(raw)) throw Error('recovery_config_refused');
  const keys = await resolvePluginEncryptionKeys({ EMDASH_ENCRYPTION_KEY: raw.trim().split('=', 2)[1] });
  if (!keys?.length) throw Error('recovery_key_missing');
  const db = new DatabaseSync(database, { readOnly: true });
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw Error('recovery_integrity_refused');
    const settings = db.prepare("SELECT name, value FROM options WHERE name LIKE 'plugin:%:settings:%' ORDER BY name").all();
    let encryptedSettings = 0, missingKeyRefused = false;
    const plugins = new Set();
    for (const row of settings) {
      const envelope = JSON.parse(row.value);
      if (!isEncryptedPluginSetting(envelope)) {
        if (envelope?.$emdash === 'plugin-setting') throw Error('recovery_envelope_refused');
        continue;
      }
      const match = /^plugin:(.+):settings:(.+)$/.exec(row.name);
      if (!match) throw Error('recovery_setting_name_refused');
      const [, plugin, key] = match;
      const schema = { [key]: { type: 'secret' } };
      if (!missingKeyRefused) {
        try { await decodePluginSettingValue(plugin, key, envelope, schema, null); }
        catch (error) { if (error?.code === 'PLUGIN_SETTING_ENCRYPTION_KEY_MISSING') missingKeyRefused = true; else throw Error('recovery_missing_key_check_refused'); }
        if (!missingKeyRefused) throw Error('recovery_missing_key_not_refused');
      }
      // EmDash 1.4.0's actual authenticated AES-GCM decoder, not a substitute decryptor.
      const plaintext = await decodePluginSettingValue(plugin, key, envelope, schema, keys);
      if (typeof plaintext !== 'string') throw Error('recovery_plaintext_refused');
      encryptedSettings++;
      plugins.add(plugin);
    }
    if (!encryptedSettings) throw Error('recovery_no_encrypted_settings');
    return { schema: 'backroadbum.emdash-recovery-check/v1', integrity: 'ok', encryptedSettings,
      encryptedPlugins: plugins.size, missingKeyRefused, decryption: 'ok', liveFilesReplaced: false,
      runtimeRestartTested: false, outboundRequests: 0 };
  } finally { db.close(); }
}

export async function withRestoredEmDash(archive) {
  const temp = await mkdtemp(join(tmpdir(), 'brb-emdash-recovery-'));
  try {
    const extracted = join(temp, 'restored');
    const result = spawnSync('python3', ['-c', `
import importlib.util, pathlib, sys
spec = importlib.util.spec_from_file_location('backup', sys.argv[1])
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)
backup.restore_emdash_copy(sys.argv[2], pathlib.Path(sys.argv[3]))
`, fileURLToPath(new URL('./backup.py', import.meta.url)), resolve(archive), extracted], { encoding: 'utf8', timeout: 60000 });
    // Never relay private paths, configuration, SQLite rows or exception output.
    if (result.status !== 0) throw Error('emdash_recovery_extraction_refused');
    return await inspectEmDashCopy(join(extracted, 'content.db'), join(extracted, 'recovery/emdash.env'));
  } finally { await rm(temp, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.umask(0o077);
  if (process.argv.length !== 3) { console.error('Usage: node ops/backroadbum/verify-emdash-recovery.mjs PRIVATE_ARCHIVE'); process.exitCode = 1; }
  else try { console.log(JSON.stringify(await withRestoredEmDash(process.argv[2]))); }
  catch { console.error('Offline EmDash credential recovery check failed; live files were not replaced.'); process.exitCode = 1; }
}
