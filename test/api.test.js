import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

let server, base;
before(async () => {
  server = createApp(openDatabase(':memory:')).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

async function call(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const login = async (u, p) => (await call('POST', '/api/login', { body: { username: u, password: p } })).data.token;

const kendaraanBaru = (over = {}) => ({
  kode_barang: '1.3.2.02.01.01.003', nomor_register: '0099', nomor_polisi: 'b 9999 tst', jenis: 'Roda 4',
  merk: 'Toyota', tipe: 'Avanza', tahun_perolehan: 2023, nilai_perolehan: 250000000,
  nomor_rangka: 'rangka-test-1', nomor_mesin: 'mesin-test-1', masa_berlaku_stnk: '2027-01-01', ...over,
});

test('login gagal dengan kata sandi salah dan API menolak tanpa token', async () => {
  assert.equal((await call('POST', '/api/login', { body: { username: 'admin', password: 'x' } })).status, 401);
  assert.equal((await call('GET', '/api/kendaraan')).status, 401);
});

test('pengurus barang OPD hanya melihat KDO milik perangkat daerahnya', async () => {
  const admin = await login('admin', 'admin123');
  const dishub = await login('dishub', 'dishub123');
  const semua = (await call('GET', '/api/kendaraan', { token: admin })).data;
  const milikDishub = (await call('GET', '/api/kendaraan', { token: dishub })).data;
  assert.ok(semua.length > milikDishub.length);
  assert.ok(milikDishub.every((k) => k.perangkat_daerah === 'Dinas Perhubungan'));
  const dinkesKdo = semua.find((k) => k.perangkat_daerah === 'Dinas Kesehatan');
  assert.equal((await call('GET', `/api/kendaraan/${dinkesKdo.id}`, { token: dishub })).status, 403);
});

test('tambah kendaraan: normalisasi, validasi, dan duplikasi nomor polisi', async () => {
  const dishub = await login('dishub', 'dishub123');
  const ok = await call('POST', '/api/kendaraan', { token: dishub, body: kendaraanBaru({ perangkat_daerah_id: 999 }) });
  assert.equal(ok.status, 201);
  assert.equal(ok.data.nomor_polisi, 'B 9999 TST');
  assert.equal(ok.data.perangkat_daerah_id, 2, 'OPD dipaksa ke OPD pengguna');
  const detail = (await call('GET', `/api/kendaraan/${ok.data.id}`, { token: dishub })).data;
  assert.equal(detail.riwayat_kondisi.length, 1, 'kondisi awal tercatat sebagai riwayat');

  const dup = await call('POST', '/api/kendaraan', {
    token: dishub, body: kendaraanBaru({ nomor_register: '0100', nomor_rangka: 'r2', nomor_mesin: 'm2' }),
  });
  assert.equal(dup.status, 400);
  assert.match(dup.data.error, /Nomor polisi sudah terdaftar/);

  const salah = await call('POST', '/api/kendaraan', { token: dishub, body: kendaraanBaru({ nomor_polisi: '1234' }) });
  assert.equal(salah.status, 400);
});

test('penetapan penanggung jawab menutup penugasan sebelumnya dan menolak pegawai OPD lain', async () => {
  const admin = await login('admin', 'admin123');
  const list = (await call('GET', '/api/kendaraan?q=B 1234 PQR', { token: admin })).data;
  const k = list[0];
  const pegawai = (await call('GET', '/api/pegawai', { token: admin })).data;
  const siti = pegawai.find((p) => p.nama === 'Siti Rahmawati');
  const andi = pegawai.find((p) => p.nama.includes('Andi'));

  const lintasOpd = await call('POST', `/api/kendaraan/${k.id}/penanggung-jawab`, {
    token: admin, body: { pegawai_id: andi.id, nomor_bast: 'BAST/X', tanggal_mulai: '2026-10-01' },
  });
  assert.equal(lintasOpd.status, 400);

  const ganti = await call('POST', `/api/kendaraan/${k.id}/penanggung-jawab`, {
    token: admin, body: { pegawai_id: siti.id, nomor_bast: 'BAST/002/DISHUB/2026', tanggal_mulai: '2026-10-01' },
  });
  assert.equal(ganti.status, 201);
  const detail = (await call('GET', `/api/kendaraan/${k.id}`, { token: admin })).data;
  assert.equal(detail.pj_nama, 'Siti Rahmawati');
  assert.equal(detail.riwayat_penanggung_jawab.length, 2);
  assert.equal(detail.riwayat_penanggung_jawab[1].tanggal_selesai, '2026-10-01');

  // Tidak boleh mengubah status menjadi usulan penghapusan selama masih ada penanggung jawab
  const status = await call('PUT', `/api/kendaraan/${k.id}`, { token: admin, body: { status: 'Usulan Penghapusan' } });
  assert.equal(status.status, 400);
});

test('pemeriksaan kondisi memperbarui kondisi kendaraan dan memvalidasi kilometer', async () => {
  const dishub = await login('dishub', 'dishub123');
  const k = (await call('GET', '/api/kendaraan?q=B 1234 PQR', { token: dishub })).data[0];

  const tanpaCatatan = await call('POST', `/api/kendaraan/${k.id}/pemeriksaan`, {
    token: dishub, body: { tanggal: '2026-11-01', kondisi: 'Rusak Ringan', kilometer: 50000 },
  });
  assert.equal(tanpaCatatan.status, 400);

  const kmMundur = await call('POST', `/api/kendaraan/${k.id}/pemeriksaan`, {
    token: dishub, body: { tanggal: '2026-11-01', kondisi: 'Baik', kilometer: 100 },
  });
  assert.equal(kmMundur.status, 400);

  const ok = await call('POST', `/api/kendaraan/${k.id}/pemeriksaan`, {
    token: dishub, body: { tanggal: '2026-11-01', kondisi: 'Rusak Ringan', kilometer: 50000, catatan: 'Kampas rem aus' },
  });
  assert.equal(ok.status, 201);
  const detail = (await call('GET', `/api/kendaraan/${k.id}`, { token: dishub })).data;
  assert.equal(detail.kondisi, 'Rusak Ringan');

  // Edit data kendaraan tidak boleh mengubah kondisi secara langsung
  await call('PUT', `/api/kendaraan/${k.id}`, { token: dishub, body: { kondisi: 'Baik', warna: 'Abu-abu' } });
  const setelah = (await call('GET', `/api/kendaraan/${k.id}`, { token: dishub })).data;
  assert.equal(setelah.kondisi, 'Rusak Ringan');
  assert.equal(setelah.warna, 'Abu-abu');
});

test('hanya admin yang dapat menetapkan status Dihapus', async () => {
  const dishub = await login('dishub', 'dishub123');
  const k = (await call('GET', '/api/kendaraan?q=B 3456 PQR', { token: dishub })).data[0];
  const res = await call('PUT', `/api/kendaraan/${k.id}`, { token: dishub, body: { status: 'Dihapus' } });
  assert.equal(res.status, 403);
});

test('dashboard dan ekspor CSV', async () => {
  const admin = await login('admin', 'admin123');
  const dash = (await call('GET', '/api/dashboard', { token: admin })).data;
  assert.ok(dash.total >= 3);
  assert.ok(Array.isArray(dash.per_perangkat_daerah));
  const csv = await call('GET', '/api/laporan/kendaraan.csv', { token: admin });
  assert.equal(csv.status, 200);
  assert.match(csv.data, /Perangkat Daerah;Kode Barang/);
});
