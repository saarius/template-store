import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { readBusinessSnapshot } from '../../scripts/inspect-backroadbum-business.mjs';

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE _plugin_storage (id TEXT, collection TEXT, data TEXT)');
  for (const table of ['ec_products', 'ec_categories', 'ec_pages']) db.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY, title TEXT)`);
  db.prepare('INSERT INTO ec_products VALUES (?,?)').run('a', 'Private draft');
  db.prepare('INSERT INTO _plugin_storage VALUES (?,?,?)').run('o', 'orders', 'private order');
  db.prepare('INSERT INTO _plugin_storage VALUES (?,?,?)').run('shadow', 'ec_products', 'not CMS');
  return db;
}

describe('read-only business evidence boundaries', () => {
  it('reads actual CMS tables independently of plugin collection names', () => {
    const db = fixture();
    try {
      const before = readBusinessSnapshot(db);
      expect(before.ec_products).toMatchObject({ source: 'cms-table', count: 1 });
      expect(before.orders).toMatchObject({ source: 'plugin-collection', count: 1 });
      expect(before.ec_pages.count).toBe(0);
      db.prepare("UPDATE _plugin_storage SET data='changed shadow' WHERE collection='ec_products'").run();
      expect(readBusinessSnapshot(db).ec_products).toEqual(before.ec_products);
      db.prepare("UPDATE ec_products SET title='Changed private draft'").run();
      expect(readBusinessSnapshot(db).ec_products.sha256).not.toBe(before.ec_products.sha256);
      expect(readBusinessSnapshot(db).orders).toEqual(before.orders);
    } finally { db.close(); }
  });
  it('emits only counts, fixed source names and hashes, with no mutation', () => {
    const db = fixture();
    try {
      const first = readBusinessSnapshot(db);
      expect(readBusinessSnapshot(db)).toEqual(first);
      expect(JSON.stringify(first)).not.toMatch(/Private|draft|private order|shadow|title/u);
      expect(Object.values(first).every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256))).toBe(true);
      expect(db.prepare('SELECT title FROM ec_products').get()).toMatchObject({ title: 'Private draft' });
    } finally { db.close(); }
  });
  it('fails if a real CMS table is missing rather than reporting an empty plugin collection', () => {
    const db = fixture();
    try {
      db.exec('DROP TABLE ec_products');
      expect(() => readBusinessSnapshot(db)).toThrow();
      // Failed read rolls back its transaction so the connection remains usable.
      expect(db.prepare('SELECT count(*) AS n FROM _plugin_storage').get()).toMatchObject({ n: 2 });
    } finally { db.close(); }
  });
});
