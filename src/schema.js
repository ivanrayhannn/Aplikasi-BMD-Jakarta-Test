// Skema & data contoh. Modul ini tidak bergantung pada Node.js agar dapat dipakai
// oleh server (node:sqlite) maupun mode demo di browser (sql.js).

export const KONDISI = ['Baik', 'Rusak Ringan', 'Rusak Berat'];
export const STATUS = ['Aktif', 'Usulan Penghapusan', 'Dihapus'];
export const JENIS = ['Roda 2', 'Roda 4', 'Roda 6 atau lebih'];

export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS perangkat_daerah (
  id INTEGER PRIMARY KEY,
  kode TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  peran TEXT NOT NULL CHECK (peran IN ('admin','opd')),
  perangkat_daerah_id INTEGER REFERENCES perangkat_daerah(id)
);

CREATE TABLE IF NOT EXISTS sesi (
  token TEXT PRIMARY KEY,
  pengguna_id INTEGER NOT NULL REFERENCES pengguna(id) ON DELETE CASCADE,
  kedaluwarsa INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pegawai (
  id INTEGER PRIMARY KEY,
  nip TEXT NOT NULL UNIQUE,
  nama TEXT NOT NULL,
  jabatan TEXT NOT NULL,
  perangkat_daerah_id INTEGER NOT NULL REFERENCES perangkat_daerah(id),
  aktif INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS kendaraan (
  id INTEGER PRIMARY KEY,
  perangkat_daerah_id INTEGER NOT NULL REFERENCES perangkat_daerah(id),
  kode_barang TEXT NOT NULL,
  nomor_register TEXT NOT NULL,
  nomor_polisi TEXT NOT NULL UNIQUE,
  jenis TEXT NOT NULL,
  merk TEXT NOT NULL,
  tipe TEXT,
  tahun_perolehan INTEGER NOT NULL,
  nilai_perolehan INTEGER NOT NULL DEFAULT 0,
  nomor_rangka TEXT NOT NULL UNIQUE,
  nomor_mesin TEXT NOT NULL UNIQUE,
  nomor_bpkb TEXT,
  warna TEXT,
  isi_silinder INTEGER,
  bahan_bakar TEXT,
  masa_berlaku_stnk TEXT,
  kondisi TEXT NOT NULL DEFAULT 'Baik',
  status TEXT NOT NULL DEFAULT 'Aktif',
  keterangan TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_pada TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (perangkat_daerah_id, kode_barang, nomor_register)
);

CREATE TABLE IF NOT EXISTS pemeriksaan_kondisi (
  id INTEGER PRIMARY KEY,
  kendaraan_id INTEGER NOT NULL REFERENCES kendaraan(id),
  tanggal TEXT NOT NULL,
  kondisi TEXT NOT NULL,
  kilometer INTEGER,
  catatan TEXT,
  dicatat_oleh INTEGER REFERENCES pengguna(id),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS penanggung_jawab (
  id INTEGER PRIMARY KEY,
  kendaraan_id INTEGER NOT NULL REFERENCES kendaraan(id),
  pegawai_id INTEGER NOT NULL REFERENCES pegawai(id),
  nomor_bast TEXT NOT NULL,
  tanggal_mulai TEXT NOT NULL,
  tanggal_selesai TEXT,
  keterangan TEXT,
  dicatat_oleh INTEGER REFERENCES pengguna(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pj_aktif ON penanggung_jawab(kendaraan_id) WHERE tanggal_selesai IS NULL;

CREATE TABLE IF NOT EXISTS log_aktivitas (
  id INTEGER PRIMARY KEY,
  waktu TEXT NOT NULL DEFAULT (datetime('now')),
  pengguna_id INTEGER,
  aksi TEXT NOT NULL,
  entitas TEXT NOT NULL,
  entitas_id INTEGER,
  detail TEXT
);
`;

/** Membuat tabel dan, bila database masih kosong, mengisi data contoh. */
export function initDatabase(db, hashPassword) {
  db.exec(SCHEMA);
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM pengguna').get();
  if (n === 0) seedDatabase(db, hashPassword);
}

export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedDatabase(db, hashPassword) {
  transaction(db, () => {
    const pd = db.prepare('INSERT INTO perangkat_daerah (kode, nama) VALUES (?, ?)');
    const pdBpad = pd.run('1.00.01', 'Badan Pengelolaan Aset Daerah').lastInsertRowid;
    const pdDishub = pd.run('2.15.01', 'Dinas Perhubungan').lastInsertRowid;
    const pdDinkes = pd.run('1.02.01', 'Dinas Kesehatan').lastInsertRowid;

    const user = db.prepare(
      'INSERT INTO pengguna (username, nama, password_hash, peran, perangkat_daerah_id) VALUES (?, ?, ?, ?, ?)'
    );
    user.run('admin', 'Administrator BPAD', hashPassword('admin123'), 'admin', pdBpad);
    user.run('dishub', 'Pengurus Barang Dinas Perhubungan', hashPassword('dishub123'), 'opd', pdDishub);
    user.run('dinkes', 'Pengurus Barang Dinas Kesehatan', hashPassword('dinkes123'), 'opd', pdDinkes);

    const peg = db.prepare('INSERT INTO pegawai (nip, nama, jabatan, perangkat_daerah_id) VALUES (?, ?, ?, ?)');
    const p1 = peg.run('197801012005011001', 'Budi Santoso', 'Kepala Bidang Lalu Lintas', pdDishub).lastInsertRowid;
    peg.run('198505152010012002', 'Siti Rahmawati', 'Kepala Seksi Angkutan', pdDishub);
    const p3 = peg.run('197907202006041003', 'dr. Andi Wijaya', 'Kepala Bidang Pelayanan Kesehatan', pdDinkes).lastInsertRowid;

    const kend = db.prepare(`INSERT INTO kendaraan
      (perangkat_daerah_id, kode_barang, nomor_register, nomor_polisi, jenis, merk, tipe, tahun_perolehan,
       nilai_perolehan, nomor_rangka, nomor_mesin, nomor_bpkb, warna, isi_silinder, bahan_bakar, masa_berlaku_stnk, kondisi)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const k1 = kend.run(pdDishub, '1.3.2.02.01.01.003', '0001', 'B 1234 PQR', 'Roda 4', 'Toyota', 'Kijang Innova 2.0 G', 2021,
      385000000, 'MHFJW8EM1M0012345', '1TRA012345', 'Q-01234567', 'Hitam', 1998, 'Bensin', '2027-03-15', 'Baik').lastInsertRowid;
    kend.run(pdDishub, '1.3.2.02.01.04.001', '0002', 'B 3456 PQR', 'Roda 2', 'Honda', 'Vario 125', 2019,
      22000000, 'MH1JFZ119KK123456', 'JFZ1E1123456', 'P-07654321', 'Merah', 125, 'Bensin', '2026-12-01', 'Rusak Ringan');
    const k3 = kend.run(pdDinkes, '1.3.2.02.01.01.003', '0001', 'B 7788 DKS', 'Roda 4', 'Mitsubishi', 'Xpander Ultimate', 2022,
      320000000, 'MK2NCXTAPNJ001234', '4A91CR1234', 'R-01112223', 'Putih', 1499, 'Bensin', '2027-08-20', 'Baik').lastInsertRowid;

    const pj = db.prepare('INSERT INTO penanggung_jawab (kendaraan_id, pegawai_id, nomor_bast, tanggal_mulai) VALUES (?,?,?,?)');
    pj.run(k1, p1, 'BAST/001/DISHUB/2024', '2024-01-08');
    pj.run(k3, p3, 'BAST/014/DINKES/2024', '2024-02-12');

    const pk = db.prepare('INSERT INTO pemeriksaan_kondisi (kendaraan_id, tanggal, kondisi, kilometer, catatan) VALUES (?,?,?,?,?)');
    pk.run(k1, '2026-06-30', 'Baik', 45210, 'Pemeriksaan semester I');
    pk.run(k3, '2026-06-30', 'Baik', 21050, 'Pemeriksaan semester I');
  });
}
