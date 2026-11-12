// Membangkitkan koleksi & environment Postman (docs/postman) dari definisi di bawah.
// Urutan permintaan dirancang berjalan dari awal sampai akhir pada database baru berisi data contoh.
// Jalankan ulang setelah menambah endpoint: node scripts/generate-postman.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const status = (code) => `pm.test("Status ${code}", () => pm.response.to.have.status(${code}));`;
const save = (variable, expr = 'pm.response.json().data.id') => `pm.collectionVariables.set("${variable}", ${expr});`;
const expect = (title, expr) => `pm.test(${JSON.stringify(title)}, () => pm.expect(${expr}).to.be.true);`;

/**
 * @param {string} name
 * @param {'GET'|'POST'|'PUT'|'DELETE'} method
 * @param {string} path tanpa /api/v1, boleh memuat {{variabel}} dan query string
 * @param {{ body?: object, tests?: string[], auth?: string|false, description?: string }} [opts]
 */
function req(name, method, path, { body, tests = [], auth = '{{token}}', description } = {}) {
  const [pathname, query = ''] = path.split('?');
  const header = [{ key: 'Content-Type', value: 'application/json' }];
  if (auth) header.push({ key: 'Authorization', value: `Bearer ${auth}` });
  return {
    name,
    request: {
      method,
      header,
      description,
      url: {
        raw: `{{baseUrl}}/api/v1${path}`,
        host: ['{{baseUrl}}'],
        path: ['api', 'v1', ...pathname.split('/').filter(Boolean)],
        ...(query && { query: query.split('&').map((p) => { const [key, value = ''] = p.split('='); return { key, value }; }) }),
      },
      ...(body && { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } }),
    },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }],
  };
}

const folder = (name, description, item) => ({ name, description, item });

const collection = {
  info: {
    name: 'SI-KDO API',
    description: 'REST API Sistem Informasi Kendaraan Dinas Operasional. Jalankan berurutan pada database baru berisi data contoh. Dokumentasi: docs/API.md',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  event: [{
    listen: 'prerequest',
    script: { type: 'text/javascript', exec: [
      'const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);',
      'pm.collectionVariables.set("hariIni", d.toISOString().slice(0, 10));',
    ] },
  }],
  variable: ['token', 'petugasToken', 'pdId', 'pnsId', 'pensiunId', 'kdoId', 'pemakaianId', 'perawatanId', 'userId', 'hariIni']
    .map((key) => ({ key, value: '' })),
  item: [
    folder('01 Auth', 'Masuk, profil, dan penolakan tanpa token.', [
      req('Login: sandi salah (401)', 'POST', '/auth/login', { auth: false, body: { email: 'admin@kdo.test', password: 'salah' },
        tests: [status(401), expect('Kode UNAUTHORIZED', 'pm.response.json().error.code === "UNAUTHORIZED"')] }),
      req('Login: field kosong (422)', 'POST', '/auth/login', { auth: false, body: {},
        tests: [status(422), expect('Pesan per field', '!!pm.response.json().error.details.email')] }),
      req('Login admin', 'POST', '/auth/login', { auth: false, body: { email: 'admin@kdo.test', password: 'admin12345' },
        tests: [status(200), save('token', 'pm.response.json().data.token'), expect('Peran admin', 'pm.response.json().data.user.role === "admin"')] }),
      req('Profil pengguna aktif', 'GET', '/auth/me', { tests: [status(200)] }),
      req('Tanpa token (401)', 'GET', '/kdo', { auth: false, tests: [status(401)] }),
      req('Pilihan terkendali (ENUM)', 'GET', '/referensi', { tests: [status(200), expect('Ada kondisi', 'pm.response.json().data.kondisi.length === 3')] }),
    ]),
    folder('02 Perangkat Daerah', 'CRUD perangkat daerah, kode/nama unik (422), hapus berelasi (409).', [
      req('Daftar (paginasi)', 'GET', '/perangkat-daerah?page=1&per_page=20', { tests: [status(200), expect('Ada meta', 'pm.response.json().meta.total >= 3')] }),
      req('Tambah', 'POST', '/perangkat-daerah', { body: { kode: 'PD-900', nama_dinas: 'Dinas Uji Postman', singkatan: 'DUP', email: 'uji@contoh.test' },
        tests: [status(201), save('pdId')] }),
      req('Tambah: kode ganda (422)', 'POST', '/perangkat-daerah', { body: { kode: 'SKPD-01', nama_dinas: 'Dinas Lain' },
        tests: [status(422), expect('Field kode disebut', '!!pm.response.json().error.details.kode')] }),
      req('Detail', 'GET', '/perangkat-daerah/{{pdId}}', { tests: [status(200)] }),
      req('Ubah', 'PUT', '/perangkat-daerah/{{pdId}}', { body: { alamat: 'Jl. Uji No. 1', no_telepon: '021-000000' },
        tests: [status(200), expect('Alamat tersimpan', 'pm.response.json().data.alamat === "Jl. Uji No. 1"')] }),
      req('Cari & filter aktif', 'GET', '/perangkat-daerah?q=uji&is_aktif=1', { tests: [status(200), expect('Ditemukan', 'pm.response.json().data.length === 1')] }),
      req('Hapus Dinas Perhubungan berelasi (409)', 'DELETE', '/perangkat-daerah/18', {
        tests: [status(409), expect('Jumlah penghalang', 'pm.response.json().error.details.pns > 0')] }),
    ]),
    folder('03 PNS', 'CRUD PNS, NIP 18 digit unik.', [
      req('Tambah: NIP salah (422)', 'POST', '/pns', { body: { nip: '123', nama_pegawai: 'A', jabatan: 'B', perangkat_daerah_id: '{{pdId}}' },
        tests: [status(422), expect('Pesan NIP', 'pm.response.json().error.details.nip.includes("18 digit")')] }),
      req('Tambah', 'POST', '/pns', { body: { nip: '199912312020121099', nama_pegawai: 'Pegawai Uji Postman', jabatan: 'Staf', golongan: 'III/a',
        perangkat_daerah_id: '{{pdId}}', jenis_kelamin: 'P' }, tests: [status(201), save('pnsId')] }),
      req('Tambah PNS pensiun', 'POST', '/pns', { body: { nip: '196205101985031005', nama_pegawai: 'Pegawai Pensiun Uji', jabatan: 'Pengemudi',
        perangkat_daerah_id: '{{pdId}}', status_kepegawaian: 'pensiun' }, tests: [status(201), save('pensiunId')] }),
      req('Tambah: NIP ganda (422)', 'POST', '/pns', { body: { nip: '199912312020121099', nama_pegawai: 'X', jabatan: 'Y', perangkat_daerah_id: '{{pdId}}' },
        tests: [status(422)] }),
      req('Daftar filter status & unit', 'GET', '/pns?status_kepegawaian=aktif&perangkat_daerah_id={{pdId}}', { tests: [status(200), expect('1 PNS', 'pm.response.json().data.length === 1')] }),
      req('Detail', 'GET', '/pns/{{pnsId}}', { tests: [status(200)] }),
      req('Ubah jabatan', 'PUT', '/pns/{{pnsId}}', { body: { jabatan: 'Pengurus Barang' }, tests: [status(200)] }),
    ]),
    folder('04 KDO', 'CRUD kendaraan, nomor polisi/rangka/mesin unik, pemegang wajib PNS aktif.', [
      req('Tambah: data salah (422)', 'POST', '/kdo', { body: { nomor_polisi: '1234', tahun_produksi: 1975 },
        tests: [status(422), expect('Field disebut', '["nomor_polisi","tahun_produksi","merek"].every((f) => pm.response.json().error.details[f])')] }),
      req('Tambah dengan pemegang', 'POST', '/kdo', { body: {
        nomor_polisi: 'b 9001 ujp', merek: 'Toyota', tipe: 'Avanza', tahun_produksi: 2024, jenis_kendaraan: 'roda_4', kondisi: 'baik',
        nomor_rangka: 'POSTMAN-RANGKA-1', nomor_mesin: 'POSTMAN-MESIN-1', perangkat_daerah_id: '{{pdId}}', pemegang_pns_id: '{{pnsId}}',
        nilai_perolehan: 250000000, masa_berlaku_stnk: '2030-01-01' },
      tests: [status(201), save('kdoId'), expect('Nopol dinormalisasi', 'pm.response.json().data.nomor_polisi === "B 9001 UJP"')] }),
      req('Tambah: nomor polisi ganda (422)', 'POST', '/kdo', { body: {
        nomor_polisi: 'B 9001 UJP', merek: 'X', tahun_produksi: 2020, jenis_kendaraan: 'roda_2', nomor_rangka: 'R2', nomor_mesin: 'M2', perangkat_daerah_id: '{{pdId}}' },
      tests: [status(422), expect('Field nomor_polisi', '!!pm.response.json().error.details.nomor_polisi')] }),
      req('Tambah: pemegang pensiun (422)', 'POST', '/kdo', { body: {
        nomor_polisi: 'B 9002 UJP', merek: 'X', tahun_produksi: 2020, jenis_kendaraan: 'roda_2', nomor_rangka: 'R3', nomor_mesin: 'M3',
        perangkat_daerah_id: '{{pdId}}', pemegang_pns_id: '{{pensiunId}}' },
      tests: [status(422), expect('Field pemegang', '!!pm.response.json().error.details.pemegang_pns_id')] }),
      req('Daftar: cari & filter', 'GET', '/kdo?q=ujp&kondisi=baik&jenis_kendaraan=roda_4', { tests: [status(200), expect('1 kendaraan', 'pm.response.json().data.length === 1')] }),
      req('Daftar: belum ada pemegang', 'GET', '/kdo?tanpa_pemegang=1', { tests: [status(200), expect('Semua tanpa pemegang', 'pm.response.json().data.every((k) => k.pemegang_pns_id === null)')] }),
      req('Detail (pemakaian aktif terbentuk)', 'GET', '/kdo/{{kdoId}}', { tests: [status(200), expect('Pemakaian aktif', 'pm.response.json().data.pemakaian_aktif !== null')] }),
      req('Ubah warna', 'PUT', '/kdo/{{kdoId}}', { body: { warna: 'Abu-abu' }, tests: [status(200)] }),
      req('Ganti pemegang saat dipakai (409)', 'PUT', '/kdo/{{kdoId}}', { body: { pemegang_pns_id: 2 }, tests: [status(409)] }),
    ]),
    folder('05 Pemakaian', 'Tautkan pemakai, satu pemakaian aktif per kendaraan, tutup pemakaian.', [
      req('Tautkan saat masih aktif (409)', 'POST', '/pemakaian', { body: { kdo_id: '{{kdoId}}', pns_id: 2, tanggal_mulai: '{{hariIni}}' }, tests: [status(409)] }),
      req('Daftar pemakaian aktif kendaraan', 'GET', '/pemakaian?kdo_id={{kdoId}}&status=aktif', {
        tests: [status(200), save('pemakaianId', 'pm.response.json().data[0].id')] }),
      req('Tutup pemakaian', 'POST', '/pemakaian/{{pemakaianId}}/selesai', { body: { tanggal_selesai: '{{hariIni}}', keterangan: 'Uji Postman' },
        tests: [status(200), expect('Status selesai', 'pm.response.json().data.status === "selesai"')] }),
      req('Tautkan PNS pensiun (422)', 'POST', '/pemakaian', { body: { kdo_id: '{{kdoId}}', pns_id: '{{pensiunId}}', tanggal_mulai: '{{hariIni}}' }, tests: [status(422)] }),
      req('Tautkan pemakai', 'POST', '/pemakaian', { body: { kdo_id: '{{kdoId}}', pns_id: '{{pnsId}}', tanggal_mulai: '{{hariIni}}', keterangan: 'Operasional' },
        tests: [status(201)] }),
    ]),
    folder('06 Perawatan', 'Catat servis, kondisi kendaraan ikut diperbarui, jadwal & rekap biaya.', [
      req('Catat: biaya negatif (422)', 'POST', '/perawatan', { body: { kdo_id: '{{kdoId}}', tanggal_servis: '{{hariIni}}', jenis_perawatan: 'rutin', biaya: -1, kondisi_setelah: 'baik' },
        tests: [status(422)] }),
      req('Catat perawatan', 'POST', '/perawatan', { body: { kdo_id: '{{kdoId}}', tanggal_servis: '{{hariIni}}', jenis_perawatan: 'perbaikan',
        biaya: 1250000, kondisi_setelah: 'rusak_ringan', bengkel: 'Bengkel uji', jadwal_berikutnya: '2099-01-01' },
      tests: [status(201), save('perawatanId')] }),
      req('Kondisi kendaraan ikut berubah', 'GET', '/kdo/{{kdoId}}', { tests: [status(200), expect('Rusak ringan', 'pm.response.json().data.kondisi === "rusak_ringan"')] }),
      req('Ubah catatan', 'PUT', '/perawatan/{{perawatanId}}', { body: { kondisi_setelah: 'baik' }, tests: [status(200)] }),
      req('Riwayat per kendaraan + ringkasan', 'GET', '/perawatan?kdo_id={{kdoId}}', { tests: [status(200), expect('Total biaya', 'pm.response.json().meta.ringkasan.total_biaya === 1250000')] }),
      req('Jadwal servis', 'GET', '/perawatan/jadwal', { tests: [status(200)] }),
      req('Rekap biaya', 'GET', '/perawatan/rekap', { tests: [status(200), expect('Urut terbesar', 'pm.response.json().data.every((r, i, a) => i === 0 || a[i - 1].total_biaya >= r.total_biaya)')] }),
    ]),
    folder('07 Dashboard & Laporan', 'Ringkasan dashboard dan tiga laporan.', [
      req('Dashboard', 'GET', '/dashboard', { tests: [status(200),
        expect('Jumlah kondisi = total', '(({ kondisi: k, total_aset: t }) => k.baik + k.rusak_ringan + k.rusak_berat === t)(pm.response.json().data)')] }),
      req('Laporan kendaraan', 'GET', '/laporan/kendaraan?perangkat_daerah_id={{pdId}}', { tests: [status(200), expect('Ada kop', '!!pm.response.json().meta.kop.nama_instansi')] }),
      req('Laporan pemakaian: periode terbalik (422)', 'GET', '/laporan/pemakaian?dari=2026-12-31&sampai=2026-01-01', { tests: [status(422)] }),
      req('Laporan pemakaian', 'GET', '/laporan/pemakaian?dari=2020-01-01', { tests: [status(200)] }),
      req('Laporan perawatan', 'GET', '/laporan/perawatan?kdo_id={{kdoId}}', { tests: [status(200)] }),
    ]),
    folder('08 Hak Akses', 'Petugas lapangan hanya dapat melihat.', [
      req('Login petugas', 'POST', '/auth/login', { auth: false, body: { email: 'petugas@kdo.test', password: 'petugas12345' },
        tests: [status(200), save('petugasToken', 'pm.response.json().data.token')] }),
      req('Petugas: lihat kendaraan', 'GET', '/kdo', { auth: '{{petugasToken}}', tests: [status(200)] }),
      req('Petugas: tambah PD (403)', 'POST', '/perangkat-daerah', { auth: '{{petugasToken}}', body: { kode: 'X', nama_dinas: 'X' }, tests: [status(403)] }),
      req('Petugas: kelola pengguna (403)', 'GET', '/pengguna', { auth: '{{petugasToken}}', tests: [status(403)] }),
    ]),
    folder('09 Pengguna & Pengaturan', 'Kelola akun (admin) dan pengaturan instansi.', [
      req('Tambah pengguna', 'POST', '/pengguna', { body: { nama: 'Pengguna Postman', email: 'postman@kdo.test', role: 'petugas', password: 'rahasia123' },
        tests: [status(201), save('userId')] }),
      req('Tambah: email ganda (422)', 'POST', '/pengguna', { body: { nama: 'X', email: 'POSTMAN@kdo.test', role: 'petugas', password: 'rahasia123' }, tests: [status(422)] }),
      req('Nonaktifkan pengguna', 'PUT', '/pengguna/{{userId}}', { body: { is_active: false }, tests: [status(200), expect('Nonaktif', 'pm.response.json().data.is_active === 0')] }),
      req('Login akun nonaktif (401)', 'POST', '/auth/login', { auth: false, body: { email: 'postman@kdo.test', password: 'rahasia123' }, tests: [status(401)] }),
      req('Baca pengaturan', 'GET', '/pengaturan', { tests: [status(200)] }),
      req('Ubah pengaturan: tidak valid (422)', 'PUT', '/pengaturan', { body: { pengingat_servis_hari: 0 }, tests: [status(422)] }),
      req('Ubah pengaturan', 'PUT', '/pengaturan', { body: { alamat: 'Alamat instansi (isi sesuai kop resmi)', pengingat_servis_hari: 21 }, tests: [status(200)] }),
      req('Log aktivitas', 'GET', '/log-aktivitas', { tests: [status(200)] }),
    ]),
    folder('10 Penutup', 'Hapus data uji: menguji SET NULL, CASCADE, dan 409.', [
      req('Hapus catatan perawatan', 'DELETE', '/perawatan/{{perawatanId}}', { tests: [status(200)] }),
      req('Hapus PD yang masih punya PNS/KDO (409)', 'DELETE', '/perangkat-daerah/{{pdId}}', { tests: [status(409)] }),
      req('Hapus PNS pensiun', 'DELETE', '/pns/{{pensiunId}}', { tests: [status(200)] }),
      req('Hapus PNS pemegang (pemegang jadi NULL)', 'DELETE', '/pns/{{pnsId}}', { tests: [status(200), expect('1 kendaraan dilepas', 'pm.response.json().data.kdo_dilepas === 1')] }),
      req('Pemegang kendaraan kosong', 'GET', '/kdo/{{kdoId}}', { tests: [status(200), expect('pemegang_pns_id null', 'pm.response.json().data.pemegang_pns_id === null')] }),
      req('Hapus kendaraan (riwayat ikut terhapus)', 'DELETE', '/kdo/{{kdoId}}', { tests: [status(200)] }),
      req('Hapus perangkat daerah', 'DELETE', '/perangkat-daerah/{{pdId}}', { tests: [status(200)] }),
      req('Detail setelah dihapus (404)', 'GET', '/perangkat-daerah/{{pdId}}', { tests: [status(404)] }),
      req('Logout', 'POST', '/auth/logout', { tests: [status(200)] }),
      req('Token setelah logout (401)', 'GET', '/auth/me', { tests: [status(401)] }),
    ]),
  ],
};

const environment = {
  name: 'KDO local',
  values: [{ key: 'baseUrl', value: 'http://localhost:3000', type: 'default', enabled: true }],
  _postman_variable_scope: 'environment',
};

mkdirSync('docs/postman', { recursive: true });
writeFileSync('docs/postman/KDO.postman_collection.json', JSON.stringify(collection, null, 2) + '\n');
writeFileSync('docs/postman/KDO-local.postman_environment.json', JSON.stringify(environment, null, 2) + '\n');
const count = collection.item.reduce((n, f) => n + f.item.length, 0);
console.log(`Koleksi Postman: ${count} permintaan dalam ${collection.item.length} folder.`);
