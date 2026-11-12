// Rancangan basis data SI-KDO untuk ditinjau pengguna (menu "Rancangan Database").
// test/db-design.test.js mencocokkan metadata ini dengan skema SQLite yang benar-benar dibuat aplikasi,
// sehingga halaman rancangan tidak bisa berbeda diam-diam dari implementasi.
import {
  KONDISI, JENIS_KENDARAAN, BAHAN_BAKAR, GOLONGAN, JENIS_KELAMIN,
  STATUS_KEPEGAWAIAN, JENIS_PERAWATAN, STATUS_PEMAKAIAN, PERAN, values,
} from './enums.js';

const enumOf = (opts) => `ENUM(${values(opts).map((v) => `'${v}'`).join(', ')})`;

/**
 * @typedef {{ name: string, mysql: string, sqlite: string, key?: 'PK'|'FK'|'UK', nullable: boolean, note: string }} Column
 * @typedef {{ name: string, kind: 'master'|'transaksi'|'sistem', purpose: string, columns: Column[] }} Table
 */
const col = (name, mysql, sqlite, nullable, note, key) => ({ name, mysql, sqlite, nullable, note, ...(key && { key }) });
const id = (note = 'Identitas unik, bertambah otomatis') => col('id', 'BIGINT UNSIGNED', 'INTEGER', false, note, 'PK');
const stamps = [
  col('created_at', 'TIMESTAMP', 'TEXT', false, 'Waktu data dibuat'),
  col('updated_at', 'TIMESTAMP', 'TEXT', false, 'Waktu perubahan terakhir'),
];

/** @type {Table[]} */
export const TABLES = [
  {
    name: 'perangkat_daerah', kind: 'master', purpose: 'Unit kerja pemilik aset kendaraan.',
    columns: [
      id(),
      col('kode', 'VARCHAR(20)', 'TEXT', false, 'Kode unit, mis. SKPD-07. Unik', 'UK'),
      col('nama_dinas', 'VARCHAR(150)', 'TEXT', false, 'Nama perangkat daerah. Unik', 'UK'),
      col('singkatan', 'VARCHAR(30)', 'TEXT', true, 'Mis. DISDIK'),
      col('alamat', 'TEXT', 'TEXT', true, 'Alamat kantor'),
      col('no_telepon', 'VARCHAR(20)', 'TEXT', true, 'Telepon kantor'),
      col('email', 'VARCHAR(100)', 'TEXT', true, 'Email kantor'),
      col('is_aktif', 'TINYINT(1)', 'INTEGER', false, '1 aktif, 0 nonaktif. Bawaan 1'),
      ...stamps,
    ],
  },
  {
    name: 'pns', kind: 'master', purpose: 'Pegawai yang dapat ditunjuk sebagai pemegang kendaraan.',
    columns: [
      id(),
      col('nip', 'CHAR(18)', 'TEXT', false, 'Nomor induk pegawai, 18 digit. Unik', 'UK'),
      col('nama_pegawai', 'VARCHAR(150)', 'TEXT', false, 'Nama lengkap'),
      col('jabatan', 'VARCHAR(150)', 'TEXT', false, 'Jabatan'),
      col('golongan', enumOf(GOLONGAN), 'TEXT', true, 'Golongan I/a s.d. IV/e'),
      col('pangkat', 'VARCHAR(50)', 'TEXT', true, 'Mis. Penata Muda'),
      col('perangkat_daerah_id', 'BIGINT UNSIGNED', 'INTEGER', false, 'Unit kerja. Hapus unit ditolak selama masih ada PNS', 'FK'),
      col('jenis_kelamin', enumOf(JENIS_KELAMIN), 'TEXT', true, 'L atau P'),
      col('no_hp', 'VARCHAR(20)', 'TEXT', true, 'Kontak pegawai'),
      col('email', 'VARCHAR(100)', 'TEXT', true, 'Email pegawai'),
      col('status_kepegawaian', enumOf(STATUS_KEPEGAWAIAN), 'TEXT', false, 'Bawaan aktif. Hanya PNS aktif yang boleh memegang kendaraan'),
      ...stamps,
    ],
  },
  {
    name: 'kdo', kind: 'master', purpose: 'Kendaraan dinas operasional sebagai aset BMD.',
    columns: [
      id(),
      col('nomor_polisi', 'VARCHAR(15)', 'TEXT', false, 'Mis. B 1234 ABC, disimpan huruf kapital. Unik', 'UK'),
      col('merek', 'VARCHAR(50)', 'TEXT', false, 'Merek kendaraan'),
      col('tipe', 'VARCHAR(80)', 'TEXT', true, 'Tipe atau model'),
      col('tahun_produksi', 'SMALLINT UNSIGNED', 'INTEGER', false, '1980 s.d. 2100'),
      col('warna', 'VARCHAR(30)', 'TEXT', true, 'Warna'),
      col('kondisi', enumOf(KONDISI), 'TEXT', false, 'Kondisi terkini; diperbarui otomatis dari perawatan terbaru'),
      col('jenis_kendaraan', enumOf(JENIS_KENDARAAN), 'TEXT', false, 'Jenis kendaraan'),
      col('nomor_rangka', 'VARCHAR(30)', 'TEXT', false, 'Unik', 'UK'),
      col('nomor_mesin', 'VARCHAR(30)', 'TEXT', true, 'Unik bila diisi (data sumber belum memuat nomor mesin)', 'UK'),
      col('isi_silinder_cc', 'INT UNSIGNED', 'INTEGER', true, 'Kapasitas mesin (cc)'),
      col('bahan_bakar', enumOf(BAHAN_BAKAR), 'TEXT', true, 'Bahan bakar'),
      col('nomor_bpkb', 'VARCHAR(30)', 'TEXT', true, 'Nomor BPKB'),
      col('masa_berlaku_stnk', 'DATE', 'TEXT', true, 'Jatuh tempo STNK; masuk pengingat 30 hari sebelumnya'),
      col('tanggal_pajak', 'DATE', 'TEXT', true, 'Jatuh tempo pajak'),
      col('tanggal_perolehan', 'DATE', 'TEXT', true, 'Tanggal perolehan aset'),
      col('nilai_perolehan', 'DECIMAL(15,2)', 'REAL', true, 'Nilai perolehan (Rp)'),
      col('kode_barang_aset', 'VARCHAR(30)', 'TEXT', true, 'Kode register BMD'),
      col('perangkat_daerah_id', 'BIGINT UNSIGNED', 'INTEGER', false, 'Pemilik kendaraan. Wajib', 'FK'),
      col('pemegang_pns_id', 'BIGINT UNSIGNED', 'INTEGER', true, 'Pemegang saat ini; diisi dari pemakaian aktif', 'FK'),
      col('keterangan', 'TEXT', 'TEXT', true, 'Catatan tambahan'),
      col('is_aktif', 'TINYINT(1)', 'INTEGER', false, '1 aktif, 0 nonaktif. Bawaan 1'),
      ...stamps,
    ],
  },
  {
    name: 'kdo_pemakaian', kind: 'transaksi', purpose: 'Riwayat siapa memakai kendaraan apa dan kapan. Maksimal satu baris aktif per kendaraan.',
    columns: [
      id(),
      col('kdo_id', 'BIGINT UNSIGNED', 'INTEGER', false, 'Kendaraan yang dipakai', 'FK'),
      col('pns_id', 'BIGINT UNSIGNED', 'INTEGER', true, 'Pegawai pemakai; kosong bila data PNS dihapus', 'FK'),
      col('pns_nama', 'VARCHAR(150)', 'TEXT', false, 'Potret nama pegawai saat ditautkan'),
      col('pns_nip', 'CHAR(18)', 'TEXT', false, 'Potret NIP pegawai saat ditautkan'),
      col('tanggal_mulai', 'DATE', 'TEXT', false, 'Awal pemakaian'),
      col('tanggal_selesai', 'DATE', 'TEXT', true, 'Akhir pemakaian; kosong = masih berjalan'),
      col('status', enumOf(STATUS_PEMAKAIAN), 'TEXT', false, 'aktif bila tanggal_selesai kosong'),
      col('keterangan', 'TEXT', 'TEXT', true, 'Keperluan pemakaian'),
      col('created_at', 'TIMESTAMP', 'TEXT', false, 'Waktu pencatatan'),
    ],
  },
  {
    name: 'kdo_perawatan', kind: 'transaksi', purpose: 'Riwayat servis, biaya, dan jadwal servis berikutnya.',
    columns: [
      id(),
      col('kdo_id', 'BIGINT UNSIGNED', 'INTEGER', false, 'Kendaraan yang dirawat', 'FK'),
      col('tanggal_servis', 'DATE', 'TEXT', false, 'Tidak boleh melebihi hari ini'),
      col('jenis_perawatan', enumOf(JENIS_PERAWATAN), 'TEXT', false, 'Jenis servis'),
      col('deskripsi', 'TEXT', 'TEXT', true, 'Uraian pekerjaan'),
      col('bengkel', 'VARCHAR(150)', 'TEXT', true, 'Bengkel atau penyedia jasa'),
      col('biaya', 'DECIMAL(15,2)', 'REAL', false, 'Biaya (Rp), tidak negatif'),
      col('kondisi_setelah', enumOf(KONDISI), 'TEXT', false, 'Menjadi kondisi kendaraan bila catatan ini yang terbaru'),
      col('jadwal_berikutnya', 'DATE', 'TEXT', true, 'Harus setelah tanggal servis; dasar pengingat'),
      ...stamps,
    ],
  },
  {
    name: 'users', kind: 'sistem', purpose: 'Akun pengguna aplikasi dan perannya.',
    columns: [
      id(),
      col('nama', 'VARCHAR(150)', 'TEXT', false, 'Nama pengguna'),
      col('email', 'VARCHAR(100)', 'TEXT', false, 'Login. Unik', 'UK'),
      col('password_hash', 'VARCHAR(255)', 'TEXT', false, 'Hash scrypt, bukan kata sandi asli'),
      col('role', enumOf(PERAN), 'TEXT', false, 'admin = Pengelola Aset, petugas = Petugas Lapangan'),
      col('pns_id', 'BIGINT UNSIGNED', 'INTEGER', true, 'Kaitan ke data pegawai (opsional)', 'FK'),
      col('is_active', 'TINYINT(1)', 'INTEGER', false, 'Akun nonaktif tidak dapat masuk'),
      ...stamps,
    ],
  },
  {
    name: 'sessions', kind: 'sistem', purpose: 'Sesi masuk (token), berlaku 8 jam.',
    columns: [
      col('id', 'CHAR(64)', 'TEXT', false, 'Token sesi acak', 'PK'),
      col('user_id', 'BIGINT UNSIGNED', 'INTEGER', false, 'Pemilik sesi', 'FK'),
      col('expires_at', 'BIGINT UNSIGNED', 'INTEGER', false, 'Waktu kedaluwarsa (milidetik epoch)'),
      col('created_at', 'TIMESTAMP', 'TEXT', false, 'Waktu masuk'),
    ],
  },
  {
    name: 'settings', kind: 'sistem', purpose: 'Satu baris pengaturan: kop laporan dan pengingat.',
    columns: [
      col('id', 'TINYINT UNSIGNED', 'INTEGER', false, 'Selalu 1', 'PK'),
      col('nama_instansi', 'VARCHAR(200)', 'TEXT', false, 'Nama di kop laporan'),
      col('alamat', 'TEXT', 'TEXT', true, 'Alamat di kop laporan'),
      col('logo_url', 'MEDIUMTEXT', 'TEXT', true, 'Logo (data URL PNG/JPG/SVG, maks. 300 KB)'),
      col('pengingat_servis_hari', 'INT UNSIGNED', 'INTEGER', false, 'Hari sebelum jadwal servis untuk pengingat. Bawaan 14'),
      col('pengingat_pembaruan_hari', 'INT UNSIGNED', 'INTEGER', false, 'Batas hari data kendaraan dianggap perlu diperbarui. Bawaan 180'),
      col('updated_at', 'TIMESTAMP', 'TEXT', false, 'Waktu perubahan terakhir'),
    ],
  },
  {
    name: 'log_aktivitas', kind: 'sistem', purpose: 'Jejak audit setiap perubahan data.',
    columns: [
      id(),
      col('waktu', 'TIMESTAMP', 'TEXT', false, 'Waktu aksi'),
      col('user_id', 'BIGINT UNSIGNED', 'INTEGER', true, 'Pelaku (tanpa FK agar log tetap utuh)'),
      col('aksi', 'VARCHAR(40)', 'TEXT', false, 'Mis. TAMBAH, UBAH, HAPUS, LOGIN'),
      col('entitas', 'VARCHAR(40)', 'TEXT', false, 'Nama tabel yang diubah'),
      col('entitas_id', 'BIGINT UNSIGNED', 'INTEGER', true, 'Id baris yang diubah'),
      col('detail', 'JSON', 'TEXT', true, 'Rincian perubahan (sebelum dan sesudah)'),
    ],
  },
];

/**
 * Relasi foreign key. `onDelete` sama persis dengan klausa di DDL.
 * @type {{ from: string, column: string, to: string, onDelete: 'RESTRICT'|'SET NULL'|'CASCADE', meaning: string }[]}
 */
export const RELATIONS = [
  { from: 'pns', column: 'perangkat_daerah_id', to: 'perangkat_daerah', onDelete: 'RESTRICT', meaning: 'Satu perangkat daerah menaungi banyak PNS. Hapus unit ditolak (409) selama masih ada PNS.' },
  { from: 'kdo', column: 'perangkat_daerah_id', to: 'perangkat_daerah', onDelete: 'RESTRICT', meaning: 'Satu perangkat daerah memiliki banyak kendaraan. Hapus unit ditolak (409) selama masih ada kendaraan.' },
  { from: 'kdo', column: 'pemegang_pns_id', to: 'pns', onDelete: 'SET NULL', meaning: 'Satu PNS dapat memegang banyak kendaraan (opsional). Hapus PNS mengosongkan pemegang.' },
  { from: 'kdo_pemakaian', column: 'kdo_id', to: 'kdo', onDelete: 'CASCADE', meaning: 'Satu kendaraan punya banyak riwayat pemakaian, maksimal satu yang aktif. Ikut terhapus bersama kendaraan.' },
  { from: 'kdo_pemakaian', column: 'pns_id', to: 'pns', onDelete: 'SET NULL', meaning: 'Satu PNS punya banyak riwayat pemakaian. Nama dan NIP tetap tersimpan bila PNS dihapus.' },
  { from: 'kdo_perawatan', column: 'kdo_id', to: 'kdo', onDelete: 'CASCADE', meaning: 'Satu kendaraan punya banyak catatan perawatan. Ikut terhapus bersama kendaraan.' },
  { from: 'users', column: 'pns_id', to: 'pns', onDelete: 'SET NULL', meaning: 'Akun dapat dikaitkan ke satu PNS (opsional).' },
  { from: 'sessions', column: 'user_id', to: 'users', onDelete: 'CASCADE', meaning: 'Satu akun punya banyak sesi. Ikut terhapus bersama akun.' },
];

/** Aturan integritas yang ditegakkan database (selain PK/FK). */
export const CONSTRAINTS = [
  'Unik: perangkat_daerah.kode, perangkat_daerah.nama_dinas, pns.nip, kdo.nomor_polisi, kdo.nomor_rangka, kdo.nomor_mesin, users.email.',
  'Satu pemakaian aktif per kendaraan: unique index parsial pada kdo_pemakaian(kdo_id) WHERE status = aktif (MySQL: kolom bantu kdo_aktif_id).',
  'Pemakaian: status aktif jika dan hanya jika tanggal_selesai kosong; tanggal_selesai tidak sebelum tanggal_mulai.',
  'Perawatan: biaya tidak negatif; jadwal_berikutnya setelah tanggal_servis.',
  'Kendaraan: tahun_produksi 1980 s.d. 2100. PNS: nip tepat 18 digit.',
  'Setiap kolom ENUM hanya menerima nilai dari daftar pilihan terkendali.',
];
