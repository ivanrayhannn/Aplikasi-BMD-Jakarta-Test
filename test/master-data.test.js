import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer, kdoBaru } from './helpers.js';

const { api, login } = useServer();
let token;
test('login admin', async () => { token = await login(); });

test('format respons { data, meta } dengan paginasi', async () => {
  const r = await api('GET', '/kdo?per_page=2&page=1', { token });
  assert.equal(r.body.data.length, 2);
  assert.deepEqual(Object.keys(r.body.meta).sort(), ['page', 'per_page', 'total', 'total_pages']);
  assert.equal(r.body.meta.total, 5);
});

test('CRUD perangkat daerah + kode/nama unik 422 + filter is_aktif', async () => {
  const created = await api('POST', '/perangkat-daerah', { token, body: { kode: 'pd-009', nama_dinas: 'Dinas Uji', email: 'uji@x.id' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.kode, 'PD-009');

  const dup = await api('POST', '/perangkat-daerah', { token, body: { kode: 'PD-001', nama_dinas: 'dinas uji' } });
  assert.equal(dup.status, 422);
  assert.ok(dup.body.error.details.kode && dup.body.error.details.nama_dinas);

  const upd = await api('PUT', `/perangkat-daerah/${created.body.data.id}`, { token, body: { is_aktif: false } });
  assert.equal(upd.body.data.is_aktif, 0);
  const nonaktif = await api('GET', '/perangkat-daerah?is_aktif=0', { token });
  assert.deepEqual(nonaktif.body.data.map((p) => p.kode), ['PD-009']);

  const del = await api('DELETE', `/perangkat-daerah/${created.body.data.id}`, { token });
  assert.equal(del.status, 200);
  assert.equal((await api('GET', `/perangkat-daerah/${created.body.data.id}`, { token })).status, 404);
});

test('hapus perangkat daerah yang masih punya PNS/KDO ditolak 409 beserta jumlah penghalang', async () => {
  const r = await api('DELETE', '/perangkat-daerah/1', { token });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONFLICT');
  assert.deepEqual(r.body.error.details, { pns: 2, kdo: 2 });
});

test('detail perangkat daerah menampilkan PNS & kendaraan miliknya', async () => {
  const r = await api('GET', '/perangkat-daerah/1', { token });
  assert.equal(r.body.data.pns.length, 2);
  assert.equal(r.body.data.kdo.length, 2);
});

test('PNS: NIP 18 digit & unik (422), filter status', async () => {
  const salah = await api('POST', '/pns', { token, body: { nip: '123', nama_pegawai: 'A', jabatan: 'B', perangkat_daerah_id: 1 } });
  assert.equal(salah.status, 422);
  assert.match(salah.body.error.details.nip, /18 digit/);
  const dup = await api('POST', '/pns', { token, body: { nip: '197801012005011001', nama_pegawai: 'A', jabatan: 'B', perangkat_daerah_id: 1 } });
  assert.match(dup.body.error.details.nip, /sudah terdaftar/);
  const pensiun = await api('GET', '/pns?status_kepegawaian=pensiun', { token });
  assert.deepEqual(pensiun.body.data.map((p) => p.nama_pegawai), ['Hendra Gunawan']);
});

test('KDO: unik nopol/rangka/mesin, tahun 1980–2100, pemegang wajib PNS aktif', async () => {
  const ok = await api('POST', '/kdo', { token, body: kdoBaru() });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.nomor_polisi, 'B 9999 TST');

  const dup = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_rangka: 'RANGKA-UJI-1', nomor_mesin: 'MESIN-UJI-1' }) });
  assert.equal(dup.status, 422);
  assert.deepEqual(Object.keys(dup.body.error.details).sort(), ['nomor_mesin', 'nomor_polisi', 'nomor_rangka']);

  const tahun = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 1 X', nomor_rangka: 'r', nomor_mesin: 'm', tahun_produksi: 1975 }) });
  assert.match(tahun.body.error.details.tahun_produksi, /1980/);

  const hendra = (await api('GET', '/pns?q=Hendra', { token })).body.data[0];
  const pensiun = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 2 X', nomor_rangka: 'r2', nomor_mesin: 'm2', pemegang_pns_id: hendra.id }) });
  assert.equal(pensiun.status, 422);
  assert.match(pensiun.body.error.details.pemegang_pns_id, /Hanya PNS aktif/);
});

test('KDO baru dengan pemegang langsung membentuk pemakaian aktif', async () => {
  const siti = (await api('GET', '/pns?q=Siti', { token })).body.data[0];
  const r = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 3 X', nomor_rangka: 'r3', nomor_mesin: 'm3', pemegang_pns_id: siti.id }) });
  const detail = (await api('GET', `/kdo/${r.body.data.id}`, { token })).body.data;
  assert.equal(detail.pemegang_nama, 'Siti Rahmawati');
  assert.equal(detail.pemakaian_aktif.pns_id, siti.id);
});

test('filter daftar kendaraan: q, kondisi, jenis, tanpa pemegang', async () => {
  const q = await api('GET', '/kdo?q=isuzu', { token });
  assert.deepEqual(q.body.data.map((k) => k.nomor_polisi), ['B 9012 PUR']);
  const rb = await api('GET', '/kdo?kondisi=rusak_berat&jenis_kendaraan=truk', { token });
  assert.equal(rb.body.data.length, 1);
  const tanpa = await api('GET', '/kdo?tanpa_pemegang=1', { token });
  assert.ok(tanpa.body.data.every((k) => k.pemegang_pns_id === null));
});

test('hapus PNS yang memegang kendaraan: pemegang menjadi NULL, pemakaian ditutup, riwayat tetap ada', async () => {
  const budi = (await api('GET', '/pns?q=Budi', { token })).body.data[0];
  const kdo = (await api('GET', '/kdo?q=B 1234 PQR', { token })).body.data[0];
  assert.equal(kdo.pemegang_pns_id, budi.id);

  const del = await api('DELETE', `/pns/${budi.id}`, { token });
  assert.equal(del.status, 200);
  assert.equal(del.body.data.kdo_dilepas, 1);

  const after = (await api('GET', `/kdo/${kdo.id}`, { token })).body.data;
  assert.equal(after.pemegang_pns_id, null);
  assert.equal(after.pemakaian_aktif, null);
  assert.ok(after.riwayat_pemakaian.every((p) => p.pns_nama === 'Budi Santoso' && p.status === 'selesai'));
});

test('status PNS tidak dapat diubah ke non-aktif selama masih memegang kendaraan', async () => {
  const andi = (await api('GET', '/pns?q=Andi', { token })).body.data[0];
  const r = await api('PUT', `/pns/${andi.id}`, { token, body: { status_kepegawaian: 'mutasi' } });
  assert.equal(r.status, 409);
});

test('hapus KDO ikut menghapus riwayat (cascade)', async () => {
  const k = (await api('GET', '/kdo?q=B 7788 DKS', { token })).body.data[0];
  const del = await api('DELETE', `/kdo/${k.id}`, { token });
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.data.riwayat_terhapus, { pemakaian: 1, perawatan: 1 });
  assert.equal((await api('GET', `/kdo/${k.id}`, { token })).status, 404);
});
