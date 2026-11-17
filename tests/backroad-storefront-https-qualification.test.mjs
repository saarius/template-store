import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { options } from '../scripts/qualify-backroadbum-installed-retained.mjs';
import { copyPublicContent, copyPublicProductMembership, isolatedServerCommand, PUBLIC_CONTENT_TABLES } from '../scripts/lib/storefront-https-proof.mjs';

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

test('public membership preserves ordering and translation groups, excludes drafts, deleted and private edges', async () => {
  const source = new Database(':memory:');
  try {
    source.exec(`CREATE TABLE _emdash_relations(id TEXT, slug TEXT, parent_collection TEXT, child_collection TEXT);
      CREATE TABLE _emdash_content_references(id TEXT, relation_id TEXT, parent_group TEXT, child_group TEXT, sort_order INTEGER);
      CREATE TABLE ec_categories(id TEXT, translation_group TEXT, status TEXT, deleted_at TEXT);
      CREATE TABLE ec_products(id TEXT, translation_group TEXT, status TEXT, deleted_at TEXT);
      INSERT INTO _emdash_relations VALUES('public','product_categories','categories','products'),
        ('private','customer_orders','customers','orders'),('wrong','product_categories','customers','orders');
      INSERT INTO ec_categories VALUES('c-en','category-group','published',NULL),
        ('draft-category',NULL,'draft',NULL),('deleted-category',NULL,'published','yesterday');
      INSERT INTO ec_products VALUES('p-en','product-group','published',NULL),
        ('p-de','product-group','published',NULL),('draft-product',NULL,'draft',NULL),
        ('deleted-product',NULL,'published','yesterday'),('simple',NULL,'published',NULL);
      INSERT INTO _emdash_content_references VALUES
        ('keep','public','category-group','product-group',7),('fallback','public','category-group','simple',2),
        ('draft-parent','public','draft-category','product-group',0),('draft-child','public','category-group','draft-product',0),
        ('deleted-parent','public','deleted-category','product-group',0),('deleted-child','public','category-group','deleted-product',0),
        ('dangling','public','category-group','missing',0),('private-edge','private','category-group','product-group',0),
        ('wrong-edge','wrong','category-group','product-group',0);`);
    const before=source.serialize(); const inserts=[];
    const db={insertInto(table){return {values(row){inserts.push({table,row});return {onConflict(){return {async execute(){}};}};}};}};
    const counts=await copyPublicProductMembership(source,db);
    assert.deepEqual(counts,{_emdash_relations:1,_emdash_content_references:2});
    assert.deepEqual(inserts.filter(x=>x.table==='_emdash_content_references').map(x=>[x.row.id,x.row.sort_order]).sort(),[['fallback',2],['keep',7]]);
    assert.equal(inserts[0].row.id,'public');
    assert.deepEqual(source.serialize(),before,'source is never changed');
  } finally {source.close();}
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
