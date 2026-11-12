// Skema basis data (PRD §6) dan data awal.
// Ditulis untuk SQLite agar berjalan sama di server (node:sqlite) dan di mode demo browser (sql.js).
// Padanan MySQL 8.4 untuk produksi: db/mysql/kdo_master_tables.sql. Jaga keduanya tetap selaras.
import {
  KONDISI, JENIS_KENDARAAN, BAHAN_BAKAR, GOLONGAN, JENIS_KELAMIN,
  STATUS_KEPEGAWAIAN, JENIS_PERAWATAN, STATUS_PEMAKAIAN, PERAN, values,
} from '../shared/enums.js';
import { transaction } from './db.js';

export const SCHEMA_VERSION = 2;

/** ENUM MySQL ditiru dengan CHECK constraint yang dibangkitkan dari shared/enums.js. */
const check = (column, opts, nullable = false) =>
  `CHECK (${nullable ? `${column} IS NULL OR ` : ''}${column} IN (${values(opts).map((v) => `'${v}'`).join(', ')}))`;

const DDL = `
CREATE TABLE IF NOT EXISTS perangkat_daerah (
  id          INTEGER PRIMARY KEY,
  kode        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nama_dinas  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  singkatan   TEXT,
  alamat      TEXT,
  no_telepon  TEXT,
  email       TEXT,
  is_aktif    INTEGER NOT NULL DEFAULT 1 CHECK (is_aktif IN (0, 1)),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pns (
  id                  INTEGER PRIMARY KEY,
  nip                 TEXT NOT NULL UNIQUE CHECK (length(nip) = 18),
  nama_pegawai        TEXT NOT NULL,
  jabatan             TEXT NOT NULL,
  golongan            TEXT ${check('golongan', GOLONGAN, true)},
  pangkat             TEXT,
  perangkat_daerah_id INTEGER NOT NULL REFERENCES perangkat_daerah(id) ON DELETE RESTRICT,
  jenis_kelamin       TEXT ${check('jenis_kelamin', JENIS_KELAMIN, true)},
  no_hp               TEXT,
  email               TEXT,
  status_kepegawaian  TEXT NOT NULL DEFAULT 'aktif' ${check('status_kepegawaian', STATUS_KEPEGAWAIAN)},
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_pns_pd ON pns(perangkat_daerah_id);

CREATE TABLE IF NOT EXISTS kdo (
  id                  INTEGER PRIMARY KEY,
  nomor_polisi        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  merek               TEXT NOT NULL,
  tipe                TEXT,
  tahun_produksi      INTEGER NOT NULL CHECK (tahun_produksi BETWEEN 1980 AND 2100),
  warna               TEXT,
  kondisi             TEXT NOT NULL DEFAULT 'baik' ${check('kondisi', KONDISI)},
  jenis_kendaraan     TEXT NOT NULL ${check('jenis_kendaraan', JENIS_KENDARAAN)},
  nomor_rangka        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nomor_mesin         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  isi_silinder_cc     INTEGER CHECK (isi_silinder_cc IS NULL OR isi_silinder_cc >= 0),
  bahan_bakar         TEXT ${check('bahan_bakar', BAHAN_BAKAR, true)},
  nomor_bpkb          TEXT,
  masa_berlaku_stnk   TEXT,
  tanggal_pajak       TEXT,
  tanggal_perolehan   TEXT,
  nilai_perolehan     REAL CHECK (nilai_perolehan IS NULL OR nilai_perolehan >= 0),
  kode_barang_aset    TEXT,
  perangkat_daerah_id INTEGER NOT NULL REFERENCES perangkat_daerah(id) ON DELETE RESTRICT,
  pemegang_pns_id     INTEGER REFERENCES pns(id) ON DELETE SET NULL,
  keterangan          TEXT,
  is_aktif            INTEGER NOT NULL DEFAULT 1 CHECK (is_aktif IN (0, 1)),
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_kdo_pd ON kdo(perangkat_daerah_id);
CREATE INDEX IF NOT EXISTS ix_kdo_pemegang ON kdo(pemegang_pns_id);

-- Riwayat pemakaian. pns_nama/pns_nip menyimpan potret data pegawai agar riwayat
-- tetap terbaca walau data PNS dihapus (pns_id menjadi NULL).
CREATE TABLE IF NOT EXISTS kdo_pemakaian (
  id              INTEGER PRIMARY KEY,
  kdo_id          INTEGER NOT NULL REFERENCES kdo(id) ON DELETE CASCADE,
  pns_id          INTEGER REFERENCES pns(id) ON DELETE SET NULL,
  pns_nama        TEXT NOT NULL,
  pns_nip         TEXT NOT NULL,
  tanggal_mulai   TEXT NOT NULL,
  tanggal_selesai TEXT,
  status          TEXT NOT NULL DEFAULT 'aktif' ${check('status', STATUS_PEMAKAIAN)},
  keterangan      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai),
  CHECK ((status = 'aktif') = (tanggal_selesai IS NULL))
);
-- Satu kendaraan hanya boleh punya satu pemakaian aktif.
CREATE UNIQUE INDEX IF NOT EXISTS ux_pemakaian_aktif ON kdo_pemakaian(kdo_id) WHERE status = 'aktif';
CREATE INDEX IF NOT EXISTS ix_pemakaian_pns ON kdo_pemakaian(pns_id);

CREATE TABLE IF NOT EXISTS kdo_perawatan (
  id                INTEGER PRIMARY KEY,
  kdo_id            INTEGER NOT NULL REFERENCES kdo(id) ON DELETE CASCADE,
  tanggal_servis    TEXT NOT NULL,
  jenis_perawatan   TEXT NOT NULL ${check('jenis_perawatan', JENIS_PERAWATAN)},
  deskripsi         TEXT,
  bengkel           TEXT,
  biaya             REAL NOT NULL DEFAULT 0 CHECK (biaya >= 0),
  kondisi_setelah   TEXT NOT NULL ${check('kondisi_setelah', KONDISI)},
  jadwal_berikutnya TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (jadwal_berikutnya IS NULL OR jadwal_berikutnya > tanggal_servis)
);
CREATE INDEX IF NOT EXISTS ix_perawatan_kdo ON kdo_perawatan(kdo_id, tanggal_servis);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  nama          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL ${check('role', PERAN)},
  pns_id        INTEGER REFERENCES pns(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Satu baris pengaturan (id = 1).
CREATE TABLE IF NOT EXISTS settings (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  nama_instansi            TEXT NOT NULL,
  alamat                   TEXT,
  logo_url                 TEXT,
  pengingat_servis_hari    INTEGER NOT NULL DEFAULT 14,
  pengingat_pembaruan_hari INTEGER NOT NULL DEFAULT 180,
  updated_at               TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id         INTEGER PRIMARY KEY,
  waktu      TEXT NOT NULL DEFAULT (datetime('now')),
  user_id    INTEGER,
  aksi       TEXT NOT NULL,
  entitas    TEXT NOT NULL,
  entitas_id INTEGER,
  detail     TEXT
);
`;

/**
 * Membuat tabel dan mengisi data awal bila database masih kosong.
 * Data wajib (PRD): pengaturan, PD-001 s.d. PD-003, dan satu akun admin.
 * Data contoh fiktif (PNS, kendaraan, riwayat, akun petugas) hanya dibuat bila `sampleData` true.
 * @param {*} db koneksi dengan API exec/prepare
 * @param {(password: string) => string} hashPassword
 * @param {{ sampleData?: boolean }} [options]
 */
export function initDatabase(db, hashPassword, { sampleData = true } = {}) {
  db.exec('PRAGMA foreign_keys = ON;');
  const version = db.prepare('PRAGMA user_version').get()?.user_version ?? 0;
  if (version !== 0 && version !== SCHEMA_VERSION) {
    // Database dari versi sebelum PRD belum berisi data produksi, jadi dibuat ulang.
    for (const t of ['log_aktivitas', 'sesi', 'penanggung_jawab', 'pemeriksaan_kondisi', 'kendaraan', 'pegawai', 'pengguna', 'perangkat_daerah']) {
      db.exec(`DROP TABLE IF EXISTS ${t}`);
    }
  }
  db.exec(DDL);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
  if (n === 0) {
    transaction(db, () => {
      seedRequired(db, hashPassword);
      if (sampleData) seedSample(db, hashPassword);
    });
  }
}

/** True bila database berisi data contoh fiktif (ditandai di UI agar tidak dikira data asli). */
export function hasSampleData(db) {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE email = 'petugas@kdo.test'").get());
}

const isoDate = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

function seedRequired(db, hashPassword) {
  // Alamat dan logo sengaja dikosongkan: diisi admin di menu Pengaturan.
  db.prepare('INSERT INTO settings (id, nama_instansi) VALUES (1, ?)').run('Instansi Aset Daerah Jakarta');
  const pd = db.prepare('INSERT INTO perangkat_daerah (kode, nama_dinas, singkatan) VALUES (?,?,?)');
  pd.run('PD-001', 'Dinas Pendidikan', 'DISDIK');
  pd.run('PD-002', 'Dinas Kesehatan', 'DINKES');
  pd.run('PD-003', 'Dinas PUPR', 'PUPR');
  db.prepare('INSERT INTO users (nama, email, password_hash, role) VALUES (?,?,?,?)')
    .run('Administrator Aset', 'admin@kdo.test', hashPassword('admin12345'), 'admin');
}

/** Data contoh fiktif untuk uji coba. Tanggal relatif terhadap hari ini agar pengingat dashboard selalu terisi. */
function seedSample(db, hashPassword) {
  const pdId = (kode) => db.prepare('SELECT id FROM perangkat_daerah WHERE kode = ?').get(kode).id;
  const [disdik, dinkes, pupr] = ['PD-001', 'PD-002', 'PD-003'].map(pdId);

  const pns = db.prepare(`INSERT INTO pns (nip, nama_pegawai, jabatan, golongan, pangkat, perangkat_daerah_id, jenis_kelamin, status_kepegawaian)
    VALUES (?,?,?,?,?,?,?,?)`);
  const budi = pns.run('197801012005011001', 'Budi Santoso', 'Kepala Bidang Sarana Prasarana', 'IV/a', 'Pembina', disdik, 'L', 'aktif').lastInsertRowid;
  pns.run('198505152010012002', 'Siti Rahmawati', 'Kepala Seksi Perlengkapan', 'III/d', 'Penata Tingkat I', disdik, 'P', 'aktif');
  const andi = pns.run('197907202006041003', 'dr. Andi Wijaya', 'Kepala Bidang Pelayanan Kesehatan', 'IV/b', 'Pembina Tingkat I', dinkes, 'L', 'aktif').lastInsertRowid;
  const rina = pns.run('199001012015032004', 'Rina Kusuma', 'Pengurus Barang', 'III/b', 'Penata Muda Tingkat I', pupr, 'P', 'aktif').lastInsertRowid;
  pns.run('196205101985031005', 'Hendra Gunawan', 'Pengemudi', 'II/d', 'Pengatur Tingkat I', pupr, 'L', 'pensiun');

  const kdo = db.prepare(`INSERT INTO kdo (nomor_polisi, merek, tipe, tahun_produksi, warna, kondisi, jenis_kendaraan, nomor_rangka, nomor_mesin,
    isi_silinder_cc, bahan_bakar, nomor_bpkb, masa_berlaku_stnk, tanggal_pajak, tanggal_perolehan, nilai_perolehan, kode_barang_aset,
    perangkat_daerah_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now', ?))`);
  const k1 = kdo.run('B 1234 PQR', 'Toyota', 'Kijang Innova 2.0 G', 2021, 'Hitam', 'baik', 'roda_4', 'CONTOH0000000001', 'CONTOHM0001',
    1998, 'bensin', 'CONTOH-BPKB-01', isoDate(240), isoDate(240), '2021-03-15', 385_000_000, '1.3.2.02.01.01.003', disdik, '-60 days').lastInsertRowid;
  const k2 = kdo.run('B 3456 PQR', 'Honda', 'Vario 125', 2019, 'Merah', 'rusak_ringan', 'roda_2', 'CONTOH0000000002', 'CONTOHM0002',
    125, 'bensin', 'CONTOH-BPKB-02', isoDate(20), isoDate(20), '2019-07-01', 22_000_000, '1.3.2.02.01.04.001', disdik, '-45 days').lastInsertRowid;
  const k3 = kdo.run('B 7788 DKS', 'Mitsubishi', 'Xpander Ultimate', 2022, 'Putih', 'baik', 'roda_4', 'CONTOH0000000003', 'CONTOHM0003',
    1499, 'bensin', 'CONTOH-BPKB-03', isoDate(300), isoDate(300), '2022-08-20', 320_000_000, '1.3.2.02.01.01.003', dinkes, '-30 days').lastInsertRowid;
  const k4 = kdo.run('B 9012 PUR', 'Isuzu', 'Elf NMR 71', 2018, 'Kuning', 'rusak_berat', 'truk', 'CONTOH0000000004', 'CONTOHM0004',
    4570, 'solar', 'CONTOH-BPKB-04', isoDate(-10), isoDate(-10), '2018-02-12', 410_000_000, '1.3.2.02.01.03.002', pupr, '-20 days').lastInsertRowid;
  kdo.run('B 2468 PUR', 'Toyota', 'Hiace Commuter', 2023, 'Silver', 'baik', 'bus', 'CONTOH0000000005', 'CONTOHM0005',
    2494, 'solar', 'CONTOH-BPKB-05', isoDate(400), isoDate(400), '2023-05-05', 590_000_000, '1.3.2.02.01.02.001', pupr, '-2 days');

  const pakai = db.prepare(`INSERT INTO kdo_pemakaian (kdo_id, pns_id, pns_nama, pns_nip, tanggal_mulai, tanggal_selesai, status, keterangan)
    VALUES (?,?,?,?,?,?,?,?)`);
  pakai.run(k1, budi, 'Budi Santoso', '197801012005011001', isoDate(-400), isoDate(-120), 'selesai', 'Operasional bidang sarpras');
  pakai.run(k1, budi, 'Budi Santoso', '197801012005011001', isoDate(-90), null, 'aktif', 'Operasional bidang sarpras');
  pakai.run(k3, andi, 'dr. Andi Wijaya', '197907202006041003', isoDate(-200), null, 'aktif', 'Operasional pelayanan kesehatan');
  pakai.run(k4, rina, 'Rina Kusuma', '199001012015032004', isoDate(-500), isoDate(-30), 'selesai', 'Angkutan material');
  db.prepare('UPDATE kdo SET pemegang_pns_id = ? WHERE id = ?').run(budi, k1);
  db.prepare('UPDATE kdo SET pemegang_pns_id = ? WHERE id = ?').run(andi, k3);

  const rawat = db.prepare(`INSERT INTO kdo_perawatan (kdo_id, tanggal_servis, jenis_perawatan, deskripsi, bengkel, biaya, kondisi_setelah, jadwal_berikutnya)
    VALUES (?,?,?,?,?,?,?,?)`);
  rawat.run(k1, isoDate(-170), 'rutin', 'Servis berkala 40.000 km', 'Bengkel rekanan A', 1_850_000, 'baik', isoDate(10));
  rawat.run(k1, isoDate(-60), 'ganti_oli', 'Ganti oli mesin dan filter', 'Bengkel rekanan A', 650_000, 'baik', isoDate(5));
  rawat.run(k2, isoDate(-40), 'perbaikan', 'Kampas rem aus, perlu penggantian', 'Bengkel rekanan B', 350_000, 'rusak_ringan', isoDate(-3));
  rawat.run(k3, isoDate(-25), 'rutin', 'Servis berkala 20.000 km', 'Bengkel rekanan C', 1_250_000, 'baik', isoDate(155));
  rawat.run(k4, isoDate(-15), 'perbaikan', 'Mesin turun, menunggu anggaran overhaul', 'Bengkel rekanan D', 2_400_000, 'rusak_berat', null);

  db.prepare('INSERT INTO users (nama, email, password_hash, role, pns_id) VALUES (?,?,?,?,?)')
    .run('Petugas Lapangan', 'petugas@kdo.test', hashPassword('petugas12345'), 'petugas', rina);
}
