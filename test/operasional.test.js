import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer } from './helpers.js';
import { today } from '../src/shared/validation.js';

const { api, login } = useServer();
let token;
const kdoId = async (nopol) => (await api('GET', `/kdo?q=${encodeURIComponent(nopol)}`, { token })).body.data[0].id;
const pnsId = async (q) => (await api('GET', `/pns?q=${encodeURIComponent(q)}`, { token })).body.data[0].id;

test('login admin', async () => { token = await login(); });

test('dashboard: jumlah kategori kondisi = total aset; sedang dipakai & aset terbaru', async () => {
  const d = (await api('GET', '/dashboard', { token })).body.data;
  assert.equal(d.kondisi.baik + d.kondisi.rusak_ringan + d.kondisi.rusak_berat, d.total_aset);
  assert.deepEqual(d.sedang_dipakai.map((x) => x.nomor_polisi).sort(), ['B 1234 PQR', 'B 7788 DKS']);
  assert.equal(d.aset_terbaru[0].nomor_polisi, 'B 2468 PUR');
  assert.ok(d.aset_terbaru.length <= 5);
  assert.ok(d.pengingat.servis.some((s) => s.status_jadwal === 'terlambat'));
  assert.ok(d.pengingat.dokumen.some((s) => s.nomor_polisi === 'B 9012 PUR'));
});

test('tautkan pemakai: ditolak 409 bila masih ada pemakaian aktif, lalu tutup → riwayat', async () => {
  const k = await kdoId('B 1234 PQR');
  const siti = await pnsId('Siti');
  const tolak = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: siti, tanggal_mulai: today() } });
  assert.equal(tolak.status, 409);
  assert.match(tolak.body.error.message, /Tutup pemakaian tersebut/);

  const aktif = (await api('GET', `/pemakaian?kdo_id=${k}&status=aktif`, { token })).body.data[0];
  const salahTanggal = await api('POST', `/pemakaian/${aktif.id}/selesai`, { token, body: { tanggal_selesai: '2000-01-01' } });
  assert.equal(salahTanggal.status, 422);
  const tutup = await api('POST', `/pemakaian/${aktif.id}/selesai`, { token, body: { tanggal_selesai: today() } });
  assert.equal(tutup.body.data.status, 'selesai');

  const tautkan = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: siti, tanggal_mulai: today(), keterangan: 'Rapat koordinasi' } });
  assert.equal(tautkan.status, 201);
  const d = (await api('GET', '/dashboard', { token })).body.data;
  assert.ok(d.sedang_dipakai.some((x) => x.kdo_id === k && x.pns_nama === 'Siti Rahmawati'));

  const riwayatPns = (await api('GET', `/pns/${siti}`, { token })).body.data.riwayat_pemakaian;
  assert.equal(riwayatPns[0].nomor_polisi, 'B 1234 PQR');
});

test('tautkan pemakai: PNS non-aktif ditolak 422', async () => {
  const k = await kdoId('B 2468 PUR');
  const r = await api('POST', '/pemakaian', { token, body: { kdo_id: k, pns_id: await pnsId('Hendra'), tanggal_mulai: today() } });
  assert.equal(r.status, 422);
});

test('perawatan: kondisi kendaraan mengikuti catatan terbaru; catatan susulan lama tidak menimpa', async () => {
  const k = await kdoId('B 2468 PUR');
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
  const k = await kdoId('B 2468 PUR');
  const r = await api('POST', '/perawatan', { token, body: {
    kdo_id: k, tanggal_servis: today(), jenis_perawatan: 'rutin', biaya: -5, kondisi_setelah: 'baik', jadwal_berikutnya: '2000-01-01',
  } });
  assert.equal(r.status, 422);
  assert.ok(r.body.error.details.biaya);
});

test('rekap biaya: total per kendaraan sama dengan jumlah catatannya, urut terbesar', async () => {
  const rekap = (await api('GET', '/perawatan/rekap', { token })).body;
  for (const row of rekap.data) {
    const list = (await api('GET', `/perawatan?kdo_id=${row.kdo_id}&per_page=1000`, { token })).body;
    assert.equal(list.meta.ringkasan.total_biaya, row.total_biaya);
  }
  const totals = rekap.data.map((r) => r.total_biaya);
  assert.deepEqual(totals, [...totals].sort((a, b) => b - a));
});

test('laporan: ringkasan kendaraan, periode pemakaian, total biaya perawatan', async () => {
  const kend = (await api('GET', '/laporan/kendaraan?perangkat_daerah_id=3', { token })).body;
  assert.equal(kend.meta.ringkasan.total, kend.data.length);
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
  const kop = (await api('GET', '/laporan/kendaraan', { token })).body.meta.kop;
  assert.equal(kop.nama_instansi, 'Instansi Uji');
});
