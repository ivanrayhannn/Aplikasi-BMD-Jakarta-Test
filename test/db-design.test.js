// Menjaga halaman "Rancangan Database" tetap sama dengan skema yang benar-benar dibuat aplikasi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/server/db.js';
import { TABLES, RELATIONS } from '../src/shared/db-design.js';

const db = openDatabase(':memory:', { sampleData: false });
const actualTables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);

test('daftar tabel rancangan = tabel di database', () => {
  assert.deepEqual(TABLES.map((t) => t.name).sort(), actualTables);
});

for (const table of TABLES) {
  test(`kolom ${table.name}: nama, urutan, tipe, NULL, PK`, () => {
    const info = db.prepare(`PRAGMA table_info(${table.name})`).all();
    assert.deepEqual(table.columns.map((c) => c.name), info.map((c) => c.name));
    for (const c of table.columns) {
      const actual = info.find((i) => i.name === c.name);
      assert.equal(c.sqlite, actual.type, `${table.name}.${c.name} tipe`);
      assert.equal(c.nullable, !actual.notnull && !actual.pk, `${table.name}.${c.name} nullable`);
      assert.equal(c.key === 'PK', actual.pk === 1, `${table.name}.${c.name} PK`);
    }
  });
}

test('relasi rancangan = foreign key di database (termasuk ON DELETE)', () => {
  const actual = actualTables.flatMap((t) =>
    db.prepare(`PRAGMA foreign_key_list(${t})`).all().map((fk) => `${t}.${fk.from} -> ${fk.table} ${fk.on_delete}`));
  const designed = RELATIONS.map((r) => `${r.from}.${r.column} -> ${r.to} ${r.onDelete}`);
  assert.deepEqual(designed.sort(), actual.sort());
  for (const table of TABLES) {
    for (const c of table.columns.filter((col) => col.key === 'FK')) {
      assert.ok(RELATIONS.some((r) => r.from === table.name && r.column === c.name), `${table.name}.${c.name} ditandai FK tetapi tidak ada relasinya`);
    }
  }
});
