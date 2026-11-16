import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { options } from '../scripts/qualify-backroadbum-installed-retained.mjs';
import { copyPublicContent, isolatedServerCommand, PUBLIC_CONTENT_TABLES } from '../scripts/lib/storefront-https-proof.mjs';

test('whole storefront is an explicit extra scope, not the default retained read', () => {
  assert.equal(options(['--check', '--candidate=/source']).storefront, false);
  assert.equal(options(['--check', '--storefront', '--candidate=/source']).storefront, true);
  for (const args of [['--storefront', '--candidate=/source'], ['--check', '--storefront', '--storefront'],
    ['--check', '--candidate=/source', '--arbitrary-mode']]) assert.throws(() => options(args));
});

test('server hides both hardcoded operational directories before dropping root', () => {
  const site = mkdtempSync(join(tmpdir(), 'storefront-host-'));
  try {
    const [command, args] = isolatedServerCommand(site, { PORT: '1234' }, '/fixture/entry.mjs');
    assert.equal(command, 'sudo');
    assert.deepEqual(args.slice(0, 6), ['-n', 'unshare', '--mount', '--propagation', 'private', 'bash']);
    const script = args[7];
    assert.ok(script.indexOf('mount --bind "$1/host-state" /var/lib/backroadbum') < script.indexOf('exec setpriv'));
    assert.ok(script.indexOf('mount --bind "$1/host-config" /etc/backroadbum') < script.indexOf('exec setpriv'));
    assert.match(script, /test ! -e \/var\/lib\/backroadbum\/content.db/);
    assert.match(script, /test ! -e \/etc\/backroadbum\/stripe.env/);
    assert.match(script, /--reuid=agent --regid=agent --init-groups env -i/);
    assert.ok(args.includes('PORT=1234'));
    const key = join(site, 'host-config/admission.key');
    assert.equal(statSync(key).mode & 0o777, 0o600);
    const bytes = readFileSync(key); assert.equal(bytes.length, 32);
    isolatedServerCommand(site, {}, '/fixture/entry.mjs');
    assert.deepEqual(readFileSync(key), bytes, 'restart must not rotate the limiter key and reset visitor admission');
  } finally { rmSync(site, { recursive: true, force: true }); }
});

test('copies only published public content, strips author/revision links, never copies users or options wholesale', async () => {
  const reads = [], inserts = [], schemas = [];
  const source = { prepare(query) {
    reads.push(query);
    return {
      get(name) {
        if (query.includes('sqlite_master')) return { sql: `CREATE TABLE ${name} (id text)` };
        return { name, value: 'true', revision: 1 };
      },
      all() { return query.includes('FROM ec_') ? [{ id: 'published', author_id: 'private-user', primary_byline_id: 'private-byline', live_revision_id: 'live', draft_revision_id: 'draft' }] : []; },
    };
  } };
  const db = { insertInto(table) { return { values(row) { inserts.push({ table, row }); return { onConflict() { return { async execute() {} }; } }; } }; } };
  const sql = { raw(query) { schemas.push(query); return { async execute() {} }; } };
  const counts = await copyPublicContent(source, db, sql);
  assert.equal(schemas.length, 3);
  for (const table of PUBLIC_CONTENT_TABLES) {
    assert.equal(counts[table], 1);
    assert.ok(reads.includes(`SELECT * FROM ${table} WHERE status='published' AND deleted_at IS NULL`));
    assert.deepEqual(inserts.find(x => x.table === table).row, { id: 'published', author_id: null, primary_byline_id: null, live_revision_id: null, draft_revision_id: null });
  }
  assert.ok(!reads.some(x => /users|credentials|auth_tokens|_plugin_state/.test(x)));
  assert.ok(reads.filter(x => /FROM options/.test(x)).every(x => x.includes('WHERE name=?')));
});
