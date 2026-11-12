import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer, kdoBaru } from './helpers.js';

const { api, login } = useServer();
let token;
const pd = async (singkatan) => (await api('GET', `/perangkat-daerah?q=${encodeURIComponent(singkatan)}`, { token })).body.data.find((p) => p.singkatan === singkatan);
const pns = async (q) => (await api('GET', `/pns?q=${encodeURIComponent(q)}`, { token })).body.data[0];
const kdo = async (nopol) => (await api('GET', `/kdo?q=${encodeURIComponent(nopol)}`, { token })).body.data[0];

test('login admin', async () => { token = await login(); });

test('format respons { data, meta } dengan paginasi', async () => {
  const r = await api('GET', '/kdo?per_page=5&page=2', { token });
  assert.equal(r.body.data.length, 5);
  assert.deepEqual(Object.keys(r.body.meta).sort(), ['page', 'per_page', 'total', 'total_pages']);
  assert.deepEqual([r.body.meta.total, r.body.meta.total_pages], [20, 4]);
});

test('CRUD perangkat daerah + kode/nama unik 422 + filter is_aktif', async () => {
  const created = await api('POST', '/perangkat-daerah', { token, body: { kode: 'skpd-99', nama_dinas: 'Dinas Uji', email: 'uji@contoh.test' } });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.kode, 'SKPD-99');

  const dup = await api('POST', '/perangkat-daerah', { token, body: { kode: 'SKPD-18', nama_dinas: 'dinas uji' } });
  assert.equal(dup.status, 422);
  assert.ok(dup.body.error.details.kode && dup.body.error.details.nama_dinas);

  const upd = await api('PUT', `/perangkat-daerah/${created.body.data.id}`, { token, body: { is_aktif: false } });
  assert.equal(upd.body.data.is_aktif, 0);
  const nonaktif = await api('GET', '/perangkat-daerah?is_aktif=0', { token });
  assert.deepEqual(nonaktif.body.data.map((p) => p.kode), ['SKPD-99']);

  assert.equal((await api('DELETE', `/perangkat-daerah/${created.body.data.id}`, { token })).status, 200);
  assert.equal((await api('GET', `/perangkat-daerah/${created.body.data.id}`, { token })).status, 404);
});

test('hapus perangkat daerah yang masih punya PNS/KDO ditolak 409 beserta jumlah penghalang', async () => {
  const dishub = await pd('Dishub');
  const r = await api('DELETE', `/perangkat-daerah/${dishub.id}`, { token });
  assert.equal(r.status, 409);
  assert.equal(r.body.error.code, 'CONFLICT');
  assert.deepEqual(r.body.error.details, { pns: 1, kdo: 2 });
});

test('detail perangkat daerah menampilkan PNS & kendaraan miliknya', async () => {
  const r = await api('GET', `/perangkat-daerah/${(await pd('Dinkes')).id}`, { token });
  assert.deepEqual(r.body.data.pns.map((p) => p.nama_pegawai), ['Sri Wahyuningsih']);
  assert.deepEqual(r.body.data.kdo.map((k) => k.nomor_polisi), ['B 1709 PQB', 'B 1938 PQB']);
});

test('PNS: NIP 18 digit & unik (422), filter status', async () => {
  const salah = await api('POST', '/pns', { token, body: { nip: '123', nama_pegawai: 'A', jabatan: 'B', perangkat_daerah_id: 1 } });
  assert.equal(salah.status, 422);
  assert.match(salah.body.error.details.nip, /18 digit/);
  const dup = await api('POST', '/pns', { token, body: { nip: '197803142005011008', nama_pegawai: 'A', jabatan: 'B', perangkat_daerah_id: 1 } });
  assert.match(dup.body.error.details.nip, /sudah terdaftar/);
  const pensiun = await api('POST', '/pns', { token, body: { nip: '196205101985031005', nama_pegawai: 'Pegawai Pensiun', jabatan: 'Pengemudi', perangkat_daerah_id: 1, status_kepegawaian: 'pensiun' } });
  assert.equal(pensiun.status, 201);
  const list = await api('GET', '/pns?status_kepegawaian=pensiun', { token });
  assert.deepEqual(list.body.data.map((p) => p.nama_pegawai), ['Pegawai Pensiun']);
});

test('KDO: unik nopol/rangka/mesin, tahun 1980–2100, pemegang wajib PNS aktif, nomor mesin boleh kosong', async () => {
  const ok = await api('POST', '/kdo', { token, body: kdoBaru() });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.nomor_polisi, 'B 9999 TST');

  const dup = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_rangka: 'RANGKA-UJI-1', nomor_mesin: 'MESIN-UJI-1' }) });
  assert.equal(dup.status, 422);
  assert.deepEqual(Object.keys(dup.body.error.details).sort(), ['nomor_mesin', 'nomor_polisi', 'nomor_rangka']);

  const tanpaMesin = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 1 X', nomor_rangka: 'r1', nomor_mesin: '' }) });
  assert.equal(tanpaMesin.status, 201);
  const tanpaMesin2 = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 2 X', nomor_rangka: 'r2', nomor_mesin: null }) });
  assert.equal(tanpaMesin2.status, 201, 'beberapa kendaraan boleh sama-sama tanpa nomor mesin');

  const tahun = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 3 X', nomor_rangka: 'r3', nomor_mesin: 'm3', tahun_produksi: 1975 }) });
  assert.match(tahun.body.error.details.tahun_produksi, /1980/);

  const pensiun = await pns('Pegawai Pensiun');
  const r = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 4 X', nomor_rangka: 'r4', nomor_mesin: 'm4', pemegang_pns_id: pensiun.id }) });
  assert.equal(r.status, 422);
  assert.match(r.body.error.details.pemegang_pns_id, /Hanya PNS aktif/);
});

test('KDO baru dengan pemegang langsung membentuk pemakaian aktif', async () => {
  const putri = await pns('Putri Ayu');
  const r = await api('POST', '/kdo', { token, body: kdoBaru({ nomor_polisi: 'B 5 X', nomor_rangka: 'r5', nomor_mesin: 'm5', pemegang_pns_id: putri.id }) });
  const detail = (await api('GET', `/kdo/${r.body.data.id}`, { token })).body.data;
  assert.equal(detail.pemegang_nama, 'Putri Ayu Anggraini');
  assert.equal(detail.pemakaian_aktif.pns_id, putri.id);
});

test('filter daftar kendaraan: q, kondisi, jenis, tanpa pemegang', async () => {
  const q = await api('GET', '/kdo?q=isuzu', { token });
  assert.deepEqual(q.body.data.map((k) => k.nomor_polisi), ['B 1709 PQB', 'B 9547 PQC']);
  const rb = await api('GET', '/kdo?kondisi=rusak_berat&jenis_kendaraan=roda_2', { token });
  assert.deepEqual(rb.body.data.map((k) => k.nomor_polisi), ['B 3920 PQJ']);
  const jabatan = await api('GET', '/kdo?peruntukan=jabatan', { token });
  assert.deepEqual(jabatan.body.data.map((k) => k.nomor_polisi), ['B 1105 PQK', 'B 1213 PQH']);
  const tanpa = await api('GET', '/kdo?tanpa_pemegang=1', { token });
  assert.ok(tanpa.body.data.length > 0 && tanpa.body.data.every((k) => k.pemegang_pns_id === null));
});

test('hapus PNS yang memegang kendaraan: pemegang menjadi NULL, pemakaian ditutup, riwayat tetap ada', async () => {
  const bambang = await pns('Bambang');
  const del = await api('DELETE', `/pns/${bambang.id}`, { token });
  assert.equal(del.status, 200);
  assert.equal(del.body.data.kdo_dilepas, 2);
  const after = (await api('GET', `/kdo/${(await kdo('B 1426 PQA')).id}`, { token })).body.data;
  assert.equal(after.pemegang_pns_id, null);
  assert.equal(after.pemakaian_aktif, null);
  assert.ok(after.riwayat_pemakaian.every((p) => p.pns_nama === 'Bambang Hermawan' && p.status === 'selesai'));
});

test('status PNS tidak dapat diubah ke non-aktif selama masih memegang kendaraan', async () => {
  const r = await api('PUT', `/pns/${(await pns('Sri Wahyuningsih')).id}`, { token, body: { status_kepegawaian: 'mutasi' } });
  assert.equal(r.status, 409);
});

test('hapus KDO ikut menghapus riwayat (cascade)', async () => {
  const k = await kdo('B 9705 PQF');
  await api('POST', '/perawatan', { token, body: { kdo_id: k.id, tanggal_servis: '2026-01-10', jenis_perawatan: 'rutin', biaya: 1, kondisi_setelah: 'baik' } });
  const del = await api('DELETE', `/kdo/${k.id}`, { token });
  assert.equal(del.status, 200);
  assert.deepEqual(del.body.data.riwayat_terhapus, { pemakaian: 1, perawatan: 1 });
  assert.equal((await api('GET', `/kdo/${k.id}`, { token })).status, 404);
});
