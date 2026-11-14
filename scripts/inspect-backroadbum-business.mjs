// Operator evidence only. Read actual CMS tables, not identically named plugin
// collections. Never emit records, private identities or database paths.
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';

/** @param {import('node:sqlite').DatabaseSync} db */
export function readBusinessSnapshot(db) {
  /** @type {Record<string, {source: string, count: number, sha256: string}>} */
  const result = {};
  db.exec('BEGIN');
  try {
    for (const name of ['orders', 'order_numbers', 'catalog_items', 'ec_products', 'ec_categories', 'ec_pages']) {
      const cms = name.startsWith('ec_');
      const rows = cms ? db.prepare(`SELECT * FROM ${name} ORDER BY id`).all()
        : db.prepare('SELECT id,data FROM _plugin_storage WHERE collection=? ORDER BY id').all(name);
      result[name] = { source: cms ? 'cms-table' : 'plugin-collection', count: rows.length,
        sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
    }
    db.exec('COMMIT');
    return result;
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

if (import.meta.main) {
  if (!process.argv.includes('--check')) {
    console.log('No action. --check reports read-only counts/hashes for Orders, numbering, catalog and actual CMS tables. --db=PATH selects an offline copy. No record contents are printed.');
  } else {
    let db;
    try {
      const path = process.argv.find(arg => arg.startsWith('--db='))?.slice(5) ?? '/var/lib/backroadbum/content.db';
      db = new DatabaseSync(path, { readOnly: true });
      console.log(JSON.stringify({ checkedAt: new Date().toISOString(), collections: readBusinessSnapshot(db) }, null, 2));
    } catch {
      console.error('Business snapshot unavailable; database paths and records withheld. Missing CMS tables are not empty collections.');
      process.exitCode = 1;
    } finally { db?.close(); }
  }
}
