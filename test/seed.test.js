import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/server/db.js';
import { hasSampleData } from '../src/api/schema.js';

test('tanpa data uji: hanya data wajib (36 SKPD + admin)', () => {
  const db = openDatabase(':memory:', { sampleData: false });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM perangkat_daerah').get().n, 36);
  assert.equal(db.prepare("SELECT nama_dinas FROM perangkat_daerah WHERE kode = 'SKPD-07'").get().nama_dinas, 'Badan Pengelolaan Aset Daerah');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kdo').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pns').get().n, 0);
  assert.deepEqual(db.prepare('SELECT email, role FROM users').all().map((u) => ({ ...u })), [{ email: 'admin@kdo.test', role: 'admin' }]);
  assert.equal(hasSampleData(db), false);
});

test('dengan data uji: sesuai ringkasan berkas sumber', () => {
  const db = openDatabase(':memory:');
  assert.equal(hasSampleData(db), true);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pns').get().n, 20);
  const k = db.prepare(`SELECT COUNT(*) AS n, SUM(nilai_perolehan) AS nilai, SUM(kondisi = 'baik') AS baik,
    SUM(kondisi = 'rusak_ringan') AS rr, SUM(kondisi = 'rusak_berat') AS rb FROM kdo`).get();
  assert.deepEqual({ ...k }, { n: 20, nilai: 11_215_600_000, baik: 15, rr: 3, rb: 2 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kdo_pemakaian WHERE status = 'aktif'").get().n, 20);
});
