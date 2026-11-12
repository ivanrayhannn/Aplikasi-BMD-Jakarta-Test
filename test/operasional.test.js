import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer } from './helpers.js';
import { today } from '../src/shared/validation.js';

const { api, login } = useServer();
let token;
const kdoId = async (nopol) => (await api('GET', `/kdo?q=${encodeURIComponent(nopol)}`, { token })).body.data[0].id;
const pnsId = async (q) => (await api('GET', `/pns?q=${encodeURIComponent(q)}`, { token })).body.data[0].id;
const addDays = (n) => { const d = new Date(today()); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

test('login admin', async () => { token = await login(); });

test('dashboard: jumlah kategori kondisi = total aset; sedang dipakai & aset terbaru', async () => {
  const d = (await api('GET', '/dashboard', { token })).body.data;
  assert.equal(d.total_aset, 20);
  assert.equal(d.kondisi.baik + d.kondisi.rusak_ringan + d.kondisi.rusak_berat, d.total_aset);
  assert.equal(d.sedang_dipakai.length, 20);
  assert.equal(d.aset_terbaru.length, 5);
  assert.deepEqual(d.pengingat.servis, []);
});

test('tautkan pemakai: ditolak 409 bila masih ada pemakaian aktif, lalu tutup → riwayat', async () => {
  const k = await kdoId('B 1426 PQA');
  const putri = await pnsId('Putri Ayu');
  const tolak = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: putri, tanggal_mulai: today() } });
  assert.equal(tolak.status, 409);
  assert.match(tolak.body.error.message, /Tutup pemakaian tersebut/);

  const aktif = (await api('GET', `/pemakaian?kdo_id=${k}&status=aktif`, { token })).body.data[0];
  const salahTanggal = await api('POST', `/pemakaian/${aktif.id}/selesai`, { token, body: { tanggal_selesai: '2000-01-01' } });
  assert.equal(salahTanggal.status, 422);
  const tutup = await api('POST', `/pemakaian/${aktif.id}/selesai`, { token, body: { tanggal_selesai: today() } });
  assert.equal(tutup.body.data.status, 'selesai');

  const tautkan = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: putri, tanggal_mulai: today(), keterangan: 'Rapat koordinasi' } });
  assert.equal(tautkan.status, 201);
  const d = (await api('GET', '/dashboard', { token })).body.data;
  assert.ok(d.sedang_dipakai.some((x) => x.kdo_id === k && x.pns_nama === 'Putri Ayu Anggraini'));
  const riwayatPns = (await api('GET', `/pns/${putri}`, { token })).body.data.riwayat_pemakaian;
  assert.equal(riwayatPns[0].nomor_polisi, 'B 1426 PQA');
});

test('tautkan pemakai: PNS non-aktif ditolak 422', async () => {
  const k = await kdoId('B 3871 PQD');
  const aktif = (await api('GET', `/pemakaian?kdo_id=${k}&status=aktif`, { token })).body.data[0];
  await api('POST', `/pemakaian/${aktif.id}/selesai`, { token, body: { tanggal_selesai: today() } });
  const pensiun = await api('POST', '/pns', { token, body: { nip: '196205101985031005', nama_pegawai: 'Pegawai Pensiun', jabatan: 'Staf', perangkat_daerah_id: 1, status_kepegawaian: 'pensiun' } });
  const r = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: pensiun.body.data.id, tanggal_mulai: today() } });
  assert.equal(r.status, 422);
});

test('perawatan: kondisi kendaraan mengikuti catatan terbaru; catatan susulan lama tidak menimpa', async () => {
  const k = await kdoId('B 1213 PQH');
  const baru = await api('POST', '/perawatan', { token, body: {
    kdo_id: k, tanggal_servis: today(), jenis_perawatan: 'perbaikan', biaya: 1250000, kondisi_setelah: 'rusak_ringan', bengkel: 'Bengkel A',
  } });
  assert.equal(baru.status, 201);
  assert.equal((await api('GET', `/kdo/${k}`, { token })).body.data.kondisi, 'rusak_ringan');

  await api('POST', '/perawatan', { token, body: { kdo_id: k, tanggal_servis: '2024-01-01', jenis_perawatan: 'rutin', biaya: 500000, kondisi_setelah: 'baik' } });
  assert.equal((await api('GET', `/kdo/${k}`, { token })).body.data.kondisi, 'rusak_ringan');

  const ubah = await api('PUT', `/perawatan/${baru.body.data.id}`, { token, body: { kondisi_setelah: 'baik' } });
  assert.equal(ubah.status, 200);
  assert.equal((await api('GET', `/kdo/${k}`, { token })).body.data.kondisi, 'baik');
});

test('perawatan: validasi jadwal berikutnya & biaya', async () => {
  const r = await api('POST', '/perawatan', { token, body: {
    kdo_id: await kdoId('B 1213 PQH'), tanggal_servis: today(), jenis_perawatan: 'rutin', biaya: -5, kondisi_setelah: 'baik', jadwal_berikutnya: '2000-01-01',
  } });
  assert.equal(r.status, 422);
  assert.ok(r.body.error.details.biaya);
});

test('jadwal servis: terlambat & segera masuk pengingat dashboard', async () => {
  const lewat = await kdoId('B 9512 PQC');
  const dekat = await kdoId('B 9620 PQE');
  await api('POST', '/perawatan', { token, body: { kdo_id: lewat, tanggal_servis: addDays(-60), jenis_perawatan: 'rutin', biaya: 900000, kondisi_setelah: 'rusak_ringan', jadwal_berikutnya: addDays(-2) } });
  await api('POST', '/perawatan', { token, body: { kdo_id: dekat, tanggal_servis: addDays(-30), jenis_perawatan: 'rutin', biaya: 700000, kondisi_setelah: 'rusak_ringan', jadwal_berikutnya: addDays(5) } });
  const jadwal = (await api('GET', '/perawatan/jadwal?perlu_servis=1', { token })).body.data;
  assert.deepEqual(jadwal.map((j) => [j.kdo_id, j.status_jadwal]), [[lewat, 'terlambat'], [dekat, 'segera']]);
  const d = (await api('GET', '/dashboard', { token })).body.data;
  assert.equal(d.pengingat.servis.length, 2);
});

test('rekap biaya: total per kendaraan sama dengan jumlah catatannya, urut terbesar', async () => {
  const rekap = (await api('GET', '/perawatan/rekap', { token })).body;
  assert.ok(rekap.data.length >= 3);
  for (const row of rekap.data) {
    const list = (await api('GET', `/perawatan?kdo_id=${row.kdo_id}&per_page=1000`, { token })).body;
    assert.equal(list.meta.ringkasan.total_biaya, row.total_biaya);
  }
  const totals = rekap.data.map((r) => r.total_biaya);
  assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
});

test('laporan: ringkasan kendaraan, periode pemakaian, total biaya perawatan', async () => {
  const kend = (await api('GET', '/laporan/kendaraan', { token })).body;
  assert.equal(kend.meta.ringkasan.total, 20);
  assert.equal(kend.data.reduce((s, r) => s + r.nilai_perolehan, 0), 11_215_600_000);
  assert.equal(kend.meta.kop.nama_instansi, 'Instansi Aset Daerah Jakarta');

  const salah = await api('GET', '/laporan/pemakaian?dari=2026-12-01&sampai=2026-01-01', { token });
  assert.equal(salah.status, 422);

  const rawat = (await api('GET', '/laporan/perawatan', { token })).body;
  assert.equal(rawat.meta.ringkasan.total_biaya, rawat.data.reduce((s, r) => s + r.biaya, 0));
});

test('pengaturan: hanya admin, validasi, tercermin di kop laporan', async () => {
  const bad = await api('PUT', '/pengaturan', { token, body: { pengingat_servis_hari: 0, logo_url: 'bukan-gambar' } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.error.details.pengingat_servis_hari && bad.body.error.details.logo_url);
  await api('PUT', '/pengaturan', { token, body: { nama_instansi: 'Instansi Uji' } });
  assert.equal((await api('GET', '/laporan/kendaraan', { token })).body.meta.kop.nama_instansi, 'Instansi Uji');
});
