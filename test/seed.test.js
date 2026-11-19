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
  // Dua kendaraan sudah dikembalikan di contoh siklus aset (B 3871 PQD siaga, B 3920 PQJ rusak).
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM kdo_pemakaian WHERE status = 'aktif'").get().n, 18);
  // Data uji dilengkapi: tidak ada kolom identitas/legalitas yang kosong.
  const kosong = db.prepare(`SELECT COUNT(*) AS n FROM kdo WHERE nomor_mesin IS NULL OR nomor_stnk IS NULL OR nomor_bpkb IS NULL
    OR masa_berlaku_stnk IS NULL OR tanggal_pajak IS NULL OR tanggal_perolehan IS NULL OR warna IS NULL OR bahan_bakar IS NULL OR lokasi IS NULL`).get().n;
  assert.equal(kosong, 0);
  const status = Object.fromEntries(db.prepare('SELECT status_aset, COUNT(*) AS n FROM kdo GROUP BY status_aset').all().map((r) => [r.status_aset, r.n]));
  assert.deepEqual(status, { aktif: 16, perawatan: 1, rusak: 2, siaga: 1 });
  const pg = db.prepare("SELECT jenis || ':' || status AS k FROM pengajuan ORDER BY id").all().map((r) => r.k);
  assert.deepEqual(pg, ['disposal:disetujui', 'penugasan:diajukan', 'mutasi:diajukan', 'pengadaan:dipesan', 'pengadaan:ditolak']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM berita_acara').get().n, 2);
});
