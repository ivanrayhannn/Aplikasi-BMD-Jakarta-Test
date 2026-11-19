// Siklus aset: approval, penugasan, pengembalian, mutasi, disposal, pengadaan, berita acara, dan hak akses per peran.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer, kdoBaru } from './helpers.js';
import { today } from '../src/shared/validation.js';

const { api, login } = useServer();
const t = {};
const cari = async (path) => (await api('GET', path, { token: t.admin })).body.data;
const kdo = async (nopol) => (await cari(`/kdo?q=${encodeURIComponent(nopol)}&is_aktif=`))[0];
const pengajuan = async (jenis, status) => (await cari(`/pengajuan?jenis=${jenis}&status=${status}`))[0];

test('login semua peran', async () => {
  t.admin = await login();
  t.approver = await login({ email: 'approver@kdo.test', password: 'approver12345' });
  t.pegawai = await login({ email: 'pegawai@kdo.test', password: 'pegawai12345' });
  t.petugas = await login({ email: 'petugas@kdo.test', password: 'petugas12345' });
  assert.ok(t.admin && t.approver && t.pegawai && t.petugas);
});

test('BR-22: hanya Approver yang memutus; tolak wajib alasan; status harus diajukan', async () => {
  const pg = await pengajuan('penugasan', 'diajukan');
  assert.equal((await api('POST', `/pengajuan/${pg.id}/setujui`, { token: t.admin, body: {} })).status, 403);
  assert.equal((await api('POST', `/pengajuan/${pg.id}/setujui`, { token: t.petugas, body: {} })).status, 403);
  const tolak = await api('POST', `/pengajuan/${pg.id}/tolak`, { token: t.approver, body: {} });
  assert.equal(tolak.status, 422);
  assert.ok(tolak.body.error.details.catatan);
  const ok = await api('POST', `/pengajuan/${pg.id}/setujui`, { token: t.approver, body: { catatan: 'Silakan' } });
  assert.equal(ok.body.data.status, 'disetujui');
  assert.equal((await api('POST', `/pengajuan/${pg.id}/setujui`, { token: t.approver, body: {} })).status, 409);
});

test('penugasan disetujui diproses admin: serah terima, status Aktif, BAST bernomor', async () => {
  const pg = await pengajuan('penugasan', 'disetujui');
  const salah = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { kdo_id: (await kdo('B 1426 PQA')).id, tanggal: today(), diserahkan_oleh: 'Pengelola Aset' } });
  assert.equal(salah.status, 422);
  const r = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { kdo_id: pg.kdo_id, tanggal: today(), diserahkan_oleh: 'Pengelola Aset' } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'selesai');
  assert.match(r.body.data.berita_acara[0].nomor, /^BAST\/KDO\/\d{4}\/\d{4}$/);
  const k = await kdo('B 3871 PQD');
  assert.equal(k.status_aset, 'aktif');
  assert.equal(k.pemegang_nama, 'Rahmawati Hasibuan');
});

test('BR-26: pegawai hanya melihat kendaraan dan pengajuannya sendiri', async () => {
  const mine = (await api('GET', '/kdo', { token: t.pegawai })).body.data;
  assert.deepEqual(mine.map((k) => k.nomor_polisi), ['B 1426 PQA']);
  assert.equal((await api('GET', `/kdo/${(await kdo('B 1709 PQB')).id}`, { token: t.pegawai })).status, 403);
  assert.equal((await api('GET', '/pns', { token: t.pegawai })).status, 403);
  assert.equal((await api('GET', '/pengajuan', { token: t.pegawai })).body.data.length, 0);
  const mutasi = await api('POST', '/pengajuan', { token: t.pegawai, body: { jenis: 'mutasi', kdo_id: mine[0].id, alasan: 'x' } });
  assert.equal(mutasi.status, 403);
  assert.equal((await api('POST', '/pengajuan', { token: t.petugas, body: { jenis: 'penugasan', alasan: 'x' } })).status, 403);
});

test('pengembalian: pegawai mengajukan, admin memeriksa dan menerima, kondisi dan status diperbarui', async () => {
  const k = await kdo('B 1426 PQA');
  const aju = await api('POST', '/pengajuan', { token: t.pegawai, body: { jenis: 'pengembalian', kdo_id: k.id, alasan: 'Pindah tugas ke kantor wilayah' } });
  assert.equal(aju.status, 201);
  assert.equal(aju.body.data.status, 'disetujui'); // pengembalian tidak memerlukan approval
  const dobel = await api('POST', '/pengajuan', { token: t.pegawai, body: { jenis: 'pengembalian', kdo_id: k.id, alasan: 'lagi' } });
  assert.equal(dobel.status, 409);
  assert.equal((await api('POST', `/pengajuan/${aju.body.data.id}/proses`, { token: t.admin, body: {} })).status, 409);

  const body = { kdo_id: k.id, pengajuan_id: aju.body.data.id, tanggal_kembali: today(), alasan: 'Pindah tugas',
    kondisi_hasil_cek: 'rusak_ringan', kilometer: 41_250, kelengkapan: ['stnk', 'kunci'], diterima_oleh: 'Ratna Juwita Lestari' };
  assert.equal((await api('POST', '/pengembalian', { token: t.pegawai, body })).status, 403);
  const invalid = await api('POST', '/pengembalian', { token: t.admin, body: { ...body, kelengkapan: ['sayap'] } });
  assert.equal(invalid.status, 422);
  const r = await api('POST', '/pengembalian', { token: t.admin, body });
  assert.equal(r.status, 201);
  assert.match(r.body.data.berita_acara_nomor, /^BAPK\//);
  const after = await kdo('B 1426 PQA');
  assert.equal(after.pemegang_pns_id, null);
  assert.equal(after.kondisi, 'rusak_ringan');
  assert.equal(after.status_aset, 'siaga');
  assert.equal((await cari(`/pengajuan/${aju.body.data.id}`)).status, 'selesai');
  assert.equal((await api('POST', '/pengembalian', { token: t.admin, body: { ...body, pengajuan_id: undefined } })).status, 409);
});

test('mutasi: perangkat daerah, lokasi, dan pemegang berubah setelah disetujui; BA mutasi', async () => {
  const pg = await pengajuan('mutasi', 'diajukan');
  assert.equal((await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: {} })).status, 409);
  await api('POST', `/pengajuan/${pg.id}/setujui`, { token: t.approver, body: {} });
  const r = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { tanggal: today(), diserahkan_oleh: 'Kepala DLH', diterima_oleh: 'Kepala Distamhut' } });
  assert.equal(r.body.data.status, 'selesai');
  const k = await kdo('B 9547 PQC');
  assert.equal(k.perangkat_daerah_singkatan, 'Distamhut');
  assert.equal(k.lokasi, 'Pembibitan Distamhut Cilandak');
  assert.equal(k.pemegang_nama, 'Dedi Kurniawan');
  const tanpaTujuan = await api('POST', '/pengajuan', { token: t.admin, body: { jenis: 'mutasi', kdo_id: k.id, alasan: 'x', lokasi_tujuan: k.lokasi } });
  assert.equal(tanpaTujuan.status, 422);
});

test('BR-25 disposal: ditolak bila masih dipegang; selesai menjadi Dihapuskan dengan nilai jual', async () => {
  const dipegang = await api('POST', '/pengajuan', { token: t.admin, body: { jenis: 'disposal', kdo_id: (await kdo('B 9433 PQS')).id, metode: 'scrap', alasan: 'x' } });
  assert.equal(dipegang.status, 409);
  const pg = await pengajuan('disposal', 'disetujui');
  const kurang = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { tanggal: today() } });
  assert.equal(kurang.status, 422);
  const r = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { tanggal: today(), nilai_jual: 9_250_000, nomor_dokumen: 'RL-123/KPKNL/2026', pembeli: 'CV Maju Jaya' } });
  assert.equal(r.body.data.detail.nilai_jual, 9_250_000);
  const k = await kdo('B 3920 PQJ');
  assert.equal(k.status_aset, 'dihapuskan');
  assert.equal(k.is_aktif, 0);
  assert.equal((await api('PUT', `/kdo/${k.id}`, { token: t.admin, body: { status_aset: 'siaga' } })).status, 422);
});

test('pengadaan: PR/PO, penerimaan unit, registrasi aset menyelesaikan pengajuan', async () => {
  const pg = await pengajuan('pengadaan', 'dipesan');
  const terima = await api('POST', `/pengajuan/${pg.id}/proses`, { token: t.admin, body: { tanggal_terima: today(), diserahkan_oleh: 'PT Karya Medika Otomotif', kelengkapan: ['stnk', 'kunci', 'buku_servis'] } });
  assert.equal(terima.body.data.status, 'diterima');
  assert.match(terima.body.data.berita_acara[0].nomor, /^BAPB\//);
  const reg = await api('POST', '/kdo', { token: t.admin, body: kdoBaru({ nomor_polisi: 'B 1999 PQZ', jenis_kendaraan: 'ambulans', pengajuan_id: pg.id }) });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.data.status_aset, 'siaga');
  const done = await cari(`/pengajuan/${pg.id}`);
  assert.equal(done.status, 'selesai');
  assert.deepEqual(done.kendaraan_teregistrasi.map((k) => k.nomor_polisi), ['B 1999 PQZ']);
  const lagi = await api('POST', '/kdo', { token: t.admin, body: kdoBaru({ nomor_polisi: 'B 1998 PQZ', nomor_rangka: 'r2', nomor_mesin: 'm2', pengajuan_id: pg.id }) });
  assert.equal(lagi.status, 422);
});

test('BR-27 status aset dari form: Dihapuskan hanya lewat disposal, Siaga tidak untuk kendaraan yang dipegang', async () => {
  const k = await kdo('B 1709 PQB');
  assert.equal((await api('PUT', `/kdo/${k.id}`, { token: t.admin, body: { status_aset: 'dihapuskan' } })).status, 422);
  assert.equal((await api('PUT', `/kdo/${k.id}`, { token: t.admin, body: { status_aset: 'siaga' } })).status, 422);
  const ok = await api('PUT', `/kdo/${k.id}`, { token: t.admin, body: { status_aset: 'perawatan' } });
  assert.equal(ok.body.data.status_aset, 'perawatan');
});

test('berita acara: daftar dan detail untuk dicetak; pegawai hanya miliknya', async () => {
  const list = await cari('/berita-acara');
  assert.ok(list.length >= 6);
  const ba = await cari(`/berita-acara/${list[0].id}`);
  assert.ok(ba.uraian && ba.jenis_label);
  const lain = list.find((b) => !/Bambang/.test(b.pihak_pertama + b.pihak_kedua));
  assert.equal((await api('GET', `/berita-acara/${lain.id}`, { token: t.pegawai })).status, 403);
  const milik = (await api('GET', '/berita-acara', { token: t.pegawai })).body.data;
  assert.ok(milik.length >= 1 && milik.every((b) => /Bambang/.test(b.pihak_pertama + b.pihak_kedua)));
});

test('akun peran Pegawai wajib ditautkan ke PNS', async () => {
  const r = await api('POST', '/pengguna', { token: t.admin, body: { nama: 'X', email: 'x@kdo.test', role: 'pegawai', password: 'rahasia123' } });
  assert.equal(r.status, 422);
  assert.ok(r.body.error.details.pns_id);
});
