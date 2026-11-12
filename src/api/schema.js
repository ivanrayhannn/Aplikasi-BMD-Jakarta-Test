// Skema basis data (PRD §6) dan data awal.
// Ditulis untuk SQLite agar berjalan sama di server (node:sqlite) dan di mode demo browser (sql.js).
// Padanan MySQL 8.4 untuk produksi: db/mysql/kdo_master_tables.sql. Jaga keduanya tetap selaras.
import {
  KONDISI, JENIS_KENDARAAN, PERUNTUKAN, BAHAN_BAKAR, GOLONGAN, JENIS_KELAMIN,
  STATUS_KEPEGAWAIAN, JENIS_PERAWATAN, STATUS_PEMAKAIAN, PERAN, values,
} from '../shared/enums.js';
import { transaction } from './db.js';
import { SKPD, PEGAWAI, KENDARAAN } from './seed-data.js';

export const SCHEMA_VERSION = 4;

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
  peruntukan          TEXT ${check('peruntukan', PERUNTUKAN, true)},
  nomor_rangka        TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nomor_mesin         TEXT UNIQUE COLLATE NOCASE,
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
 * Data wajib: pengaturan, 36 perangkat daerah (SKPD), dan satu akun admin.
 * Data uji (pegawai, kendaraan, pemakaian, akun petugas) dari docs/data hanya dibuat bila `sampleData` true.
 * @param {*} db koneksi dengan API exec/prepare
 * @param {(password: string) => string} hashPassword
 * @param {{ sampleData?: boolean }} [options]
 */
export function initDatabase(db, hashPassword, { sampleData = true } = {}) {
  db.exec('PRAGMA foreign_keys = ON;');
  const version = db.prepare('PRAGMA user_version').get()?.user_version ?? 0;
  if (version !== 0 && version !== SCHEMA_VERSION) {
    // Belum ada data produksi; database versi lama dibuat ulang dengan skema dan data awal terbaru.
    for (const t of ['log_aktivitas', 'sessions', 'settings', 'kdo_perawatan', 'kdo_pemakaian', 'users', 'kdo', 'pns', 'perangkat_daerah',
      'sesi', 'penanggung_jawab', 'pemeriksaan_kondisi', 'kendaraan', 'pegawai', 'pengguna']) {
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

/** True bila database berisi data uji (ditandai di UI sebagai lingkungan uji). */
export function hasSampleData(db) {
  return Boolean(db.prepare("SELECT 1 FROM users WHERE email = 'petugas@kdo.test'").get());
}

function seedRequired(db, hashPassword) {
  // Alamat dan logo sengaja dikosongkan: diisi admin di menu Pengaturan.
  db.prepare('INSERT INTO settings (id, nama_instansi) VALUES (1, ?)').run('Instansi Aset Daerah Jakarta');
  const pd = db.prepare('INSERT INTO perangkat_daerah (kode, nama_dinas, singkatan) VALUES (?,?,?)');
  for (const s of SKPD) pd.run(s.kode, s.nama_dinas, s.singkatan);
  db.prepare('INSERT INTO users (nama, email, password_hash, role) VALUES (?,?,?,?)')
    .run('Pengelola Aset', 'admin@kdo.test', hashPassword('admin12345'), 'admin');
}

/** Data uji pegawai dan kendaraan dari pemilik produk (src/api/seed-data.js). */
function seedSample(db, hashPassword) {
  const pdBySingkatan = new Map(db.prepare('SELECT id, singkatan FROM perangkat_daerah').all().map((r) => [r.singkatan, r.id]));

  const pns = db.prepare(`INSERT INTO pns (nip, nama_pegawai, jabatan, golongan, perangkat_daerah_id, jenis_kelamin)
    VALUES (?,?,?,?,?,?)`);
  const pnsByNip = new Map();
  for (const p of PEGAWAI) {
    const id = pns.run(p.nip, p.nama_pegawai, p.jabatan, p.golongan, pdBySingkatan.get(p.skpd), p.jenis_kelamin).lastInsertRowid;
    pnsByNip.set(p.nip, { id, ...p });
  }

  const kdo = db.prepare(`INSERT INTO kdo (kode_barang_aset, nomor_polisi, merek, tipe, jenis_kendaraan, peruntukan, tahun_produksi,
    nomor_rangka, kondisi, nilai_perolehan, keterangan, perangkat_daerah_id, pemegang_pns_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  // Sumber tidak memuat tanggal penugasan, jadi pemakaian aktif dicatat sejak data dimuat.
  const pakai = db.prepare(`INSERT INTO kdo_pemakaian (kdo_id, pns_id, pns_nama, pns_nip, tanggal_mulai, status, keterangan)
    VALUES (?,?,?,?,date('now','localtime'),'aktif','Penetapan pemegang dari data awal')`);
  for (const k of KENDARAAN) {
    const pemegang = pnsByNip.get(k.pemegang_nip);
    const id = kdo.run(k.kode_barang_aset, k.nomor_polisi, k.merek, k.tipe, k.jenis_kendaraan, k.peruntukan, k.tahun_produksi, k.nomor_rangka,
      k.kondisi, k.nilai_perolehan, k.keterangan, pdBySingkatan.get(k.skpd), pemegang.id).lastInsertRowid;
    pakai.run(id, pemegang.id, pemegang.nama_pegawai, pemegang.nip);
  }

  const putri = pnsByNip.get('199404302019032008');
  db.prepare('INSERT INTO users (nama, email, password_hash, role, pns_id) VALUES (?,?,?,?,?)')
    .run(putri.nama_pegawai, 'petugas@kdo.test', hashPassword('petugas12345'), 'petugas', putri.id);
}
