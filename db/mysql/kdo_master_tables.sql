-- SI-KDO: DDL MySQL 8.4 untuk database kdo_db (PRD bagian 6).
-- Padanan dari skema SQLite di src/api/schema.js. Jaga kedua file tetap selaras:
-- nama tabel/kolom, ENUM (sumber: src/shared/enums.js), constraint unik, dan aturan ON DELETE.
--
-- Pemakaian (Laragon / MySQL 8.4):
--   mysql -u root -p < db/mysql/kdo_master_tables.sql

CREATE DATABASE IF NOT EXISTS kdo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE kdo_db;

-- Tabel master 1: perangkat daerah (pemilik aset)
CREATE TABLE perangkat_daerah (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kode        VARCHAR(20)  NOT NULL,
  nama_dinas  VARCHAR(150) NOT NULL,
  singkatan   VARCHAR(30)  NULL,
  alamat      TEXT         NULL,
  no_telepon  VARCHAR(20)  NULL,
  email       VARCHAR(100) NULL,
  is_aktif    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pd_kode (kode),
  UNIQUE KEY uk_pd_nama_dinas (nama_dinas)
) ENGINE=InnoDB;

-- Tabel master 2: PNS (calon pemegang kendaraan)
CREATE TABLE pns (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nip                 CHAR(18)     NOT NULL,
  nama_pegawai        VARCHAR(150) NOT NULL,
  jabatan             VARCHAR(150) NOT NULL,
  golongan            ENUM('I/a','I/b','I/c','I/d','II/a','II/b','II/c','II/d',
                           'III/a','III/b','III/c','III/d','IV/a','IV/b','IV/c','IV/d','IV/e') NULL,
  pangkat             VARCHAR(50)  NULL,
  perangkat_daerah_id BIGINT UNSIGNED NOT NULL,
  jenis_kelamin       ENUM('L','P') NULL,
  no_hp               VARCHAR(20)  NULL,
  email               VARCHAR(100) NULL,
  status_kepegawaian  ENUM('aktif','pensiun','mutasi','nonaktif') NOT NULL DEFAULT 'aktif',
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pns_nip (nip),
  KEY ix_pns_pd (perangkat_daerah_id),
  CONSTRAINT chk_pns_nip CHECK (nip REGEXP '^[0-9]{18}$'),
  -- Hapus perangkat daerah yang masih punya PNS ditolak (API menjawab 409).
  CONSTRAINT fk_pns_pd FOREIGN KEY (perangkat_daerah_id) REFERENCES perangkat_daerah (id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Tabel master 3: kendaraan dinas operasional
CREATE TABLE kdo (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nomor_polisi        VARCHAR(15)  NOT NULL,
  merek               VARCHAR(50)  NOT NULL,
  tipe                VARCHAR(80)  NULL,
  tahun_produksi      SMALLINT UNSIGNED NOT NULL,
  warna               VARCHAR(30)  NULL,
  kondisi             ENUM('baik','rusak_ringan','rusak_berat') NOT NULL DEFAULT 'baik',
  jenis_kendaraan     ENUM('roda_2','roda_4','roda_6','bus','truk','lainnya') NOT NULL,
  nomor_rangka        VARCHAR(30)  NOT NULL,
  nomor_mesin         VARCHAR(30)  NULL,  -- unik bila diisi; data sumber belum memuat nomor mesin
  isi_silinder_cc     INT UNSIGNED NULL,
  bahan_bakar         ENUM('bensin','solar','listrik','hybrid','lainnya') NULL,
  nomor_bpkb          VARCHAR(30)  NULL,
  masa_berlaku_stnk   DATE         NULL,
  tanggal_pajak       DATE         NULL,
  tanggal_perolehan   DATE         NULL,
  nilai_perolehan     DECIMAL(15,2) NULL,
  kode_barang_aset    VARCHAR(30)  NULL,
  perangkat_daerah_id BIGINT UNSIGNED NOT NULL,
  pemegang_pns_id     BIGINT UNSIGNED NULL,
  keterangan          TEXT         NULL,
  is_aktif            TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_kdo_nopol (nomor_polisi),
  UNIQUE KEY uk_kdo_rangka (nomor_rangka),
  UNIQUE KEY uk_kdo_mesin (nomor_mesin),
  KEY ix_kdo_pd (perangkat_daerah_id),
  KEY ix_kdo_pemegang (pemegang_pns_id),
  CONSTRAINT chk_kdo_tahun CHECK (tahun_produksi BETWEEN 1980 AND 2100),
  CONSTRAINT fk_kdo_pd FOREIGN KEY (perangkat_daerah_id) REFERENCES perangkat_daerah (id) ON DELETE RESTRICT,
  -- Keputusan final PRD: hapus PNS tetap diizinkan, penanggung jawab kendaraan dikosongkan.
  CONSTRAINT fk_kdo_pemegang FOREIGN KEY (pemegang_pns_id) REFERENCES pns (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabel pendukung: riwayat pemakaian. pns_nama/pns_nip menyimpan potret pegawai
-- agar riwayat tetap terbaca setelah data PNS dihapus.
CREATE TABLE kdo_pemakaian (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kdo_id          BIGINT UNSIGNED NOT NULL,
  pns_id          BIGINT UNSIGNED NULL,
  pns_nama        VARCHAR(150) NOT NULL,
  pns_nip         CHAR(18)     NOT NULL,
  tanggal_mulai   DATE         NOT NULL,
  tanggal_selesai DATE         NULL,
  status          ENUM('aktif','selesai') NOT NULL DEFAULT 'aktif',
  keterangan      TEXT         NULL,
  created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Kolom bantu: bernilai kdo_id hanya saat status aktif, sehingga UNIQUE menjamin
  -- satu pemakaian aktif per kendaraan (MySQL belum punya unique index parsial).
  kdo_aktif_id    BIGINT UNSIGNED AS (IF(status = 'aktif', kdo_id, NULL)) STORED,
  PRIMARY KEY (id),
  UNIQUE KEY uk_pemakaian_aktif (kdo_aktif_id),
  KEY ix_pemakaian_kdo (kdo_id),
  KEY ix_pemakaian_pns (pns_id),
  CONSTRAINT chk_pemakaian_tanggal CHECK (tanggal_selesai IS NULL OR tanggal_selesai >= tanggal_mulai),
  CONSTRAINT chk_pemakaian_status CHECK ((status = 'aktif') = (tanggal_selesai IS NULL)),
  CONSTRAINT fk_pemakaian_kdo FOREIGN KEY (kdo_id) REFERENCES kdo (id) ON DELETE CASCADE,
  CONSTRAINT fk_pemakaian_pns FOREIGN KEY (pns_id) REFERENCES pns (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Tabel pendukung: riwayat perawatan
CREATE TABLE kdo_perawatan (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kdo_id            BIGINT UNSIGNED NOT NULL,
  tanggal_servis    DATE          NOT NULL,
  jenis_perawatan   ENUM('rutin','perbaikan','ganti_oli','pajak','lainnya') NOT NULL,
  deskripsi         TEXT          NULL,
  bengkel           VARCHAR(150)  NULL,
  biaya             DECIMAL(15,2) NOT NULL DEFAULT 0,
  kondisi_setelah   ENUM('baik','rusak_ringan','rusak_berat') NOT NULL,
  jadwal_berikutnya DATE          NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_perawatan_kdo (kdo_id, tanggal_servis),
  CONSTRAINT chk_perawatan_biaya CHECK (biaya >= 0),
  CONSTRAINT chk_perawatan_jadwal CHECK (jadwal_berikutnya IS NULL OR jadwal_berikutnya > tanggal_servis),
  CONSTRAINT fk_perawatan_kdo FOREIGN KEY (kdo_id) REFERENCES kdo (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Tabel pendukung: akun, sesi, pengaturan, jejak audit
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nama          VARCHAR(150) NOT NULL,
  email         VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','petugas') NOT NULL,
  pns_id        BIGINT UNSIGNED NULL,
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_users_email (email),
  CONSTRAINT fk_users_pns FOREIGN KEY (pns_id) REFERENCES pns (id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE sessions (
  id         CHAR(64)        NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  expires_at BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_sessions_user (user_id),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE settings (
  id                       TINYINT UNSIGNED NOT NULL,
  nama_instansi            VARCHAR(200) NOT NULL,
  alamat                   TEXT         NULL,
  logo_url                 MEDIUMTEXT   NULL,
  pengingat_servis_hari    INT UNSIGNED NOT NULL DEFAULT 14,
  pengingat_pembaruan_hari INT UNSIGNED NOT NULL DEFAULT 180,
  updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_settings_single CHECK (id = 1)
) ENGINE=InnoDB;

CREATE TABLE log_aktivitas (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  waktu      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id    BIGINT UNSIGNED NULL,
  aksi       VARCHAR(40)     NOT NULL,
  entitas    VARCHAR(40)     NOT NULL,
  entitas_id BIGINT UNSIGNED NULL,
  detail     JSON            NULL,
  PRIMARY KEY (id),
  KEY ix_log_entitas (entitas, entitas_id)
) ENGINE=InnoDB;

-- Data awal wajib: pengaturan dan 36 SKPD (sumber: docs/data/data_aset_kendaraan_dki.md).
INSERT INTO settings (id, nama_instansi) VALUES (1, 'Instansi Aset Daerah Jakarta');
INSERT INTO perangkat_daerah (kode, nama_dinas, singkatan) VALUES
  ('SKPD-01', 'Sekretariat Daerah', 'Setda'),
  ('SKPD-02', 'Sekretariat DPRD', 'Setwan'),
  ('SKPD-03', 'Inspektorat', 'Itprov'),
  ('SKPD-04', 'Badan Perencanaan Pembangunan Daerah', 'Bappeda'),
  ('SKPD-05', 'Badan Pengelola Keuangan Daerah', 'BPKD'),
  ('SKPD-06', 'Badan Pendapatan Daerah', 'Bapenda'),
  ('SKPD-07', 'Badan Pengelolaan Aset Daerah', 'BPAD'),
  ('SKPD-08', 'Badan Kepegawaian Daerah', 'BKD'),
  ('SKPD-09', 'Badan Pengembangan Sumber Daya Manusia', 'BPSDM'),
  ('SKPD-10', 'Badan Penanggulangan Bencana Daerah', 'BPBD'),
  ('SKPD-11', 'Badan Kesatuan Bangsa dan Politik', 'Kesbangpol'),
  ('SKPD-12', 'Badan Pembinaan BUMD', 'BP BUMD'),
  ('SKPD-13', 'Biro Pengadaan Barang dan Jasa', 'BPBJ'),
  ('SKPD-14', 'Satuan Polisi Pamong Praja', 'Satpol PP'),
  ('SKPD-15', 'Dinas Pendidikan', 'Disdik'),
  ('SKPD-16', 'Dinas Kesehatan', 'Dinkes'),
  ('SKPD-17', 'Dinas Sosial', 'Dinsos'),
  ('SKPD-18', 'Dinas Perhubungan', 'Dishub'),
  ('SKPD-19', 'Dinas Bina Marga', 'DBM'),
  ('SKPD-20', 'Dinas Sumber Daya Air', 'DSDA'),
  ('SKPD-21', 'Dinas Lingkungan Hidup', 'DLH'),
  ('SKPD-22', 'Dinas Cipta Karya, Tata Ruang dan Pertanahan', 'Citata'),
  ('SKPD-23', 'Dinas Perumahan Rakyat dan Kawasan Permukiman', 'DPRKP'),
  ('SKPD-24', 'Dinas Pertamanan dan Hutan Kota', 'Distamhut'),
  ('SKPD-25', 'Dinas Penanggulangan Kebakaran dan Penyelamatan', 'Gulkarmat'),
  ('SKPD-26', 'Dinas Kependudukan dan Pencatatan Sipil', 'Dukcapil'),
  ('SKPD-27', 'Dinas Komunikasi, Informatika dan Statistik', 'Diskominfotik'),
  ('SKPD-28', 'Dinas Penanaman Modal dan PTSP', 'DPMPTSP'),
  ('SKPD-29', 'Dinas Perindustrian, Perdagangan, Koperasi dan UKM', 'PPKUKM'),
  ('SKPD-30', 'Dinas Tenaga Kerja, Transmigrasi dan Energi', 'Disnakertransgi'),
  ('SKPD-31', 'Dinas Ketahanan Pangan, Kelautan dan Pertanian', 'KPKP'),
  ('SKPD-32', 'Dinas PPAPP', 'PPAPP'),
  ('SKPD-33', 'Dinas Pemuda dan Olahraga', 'Dispora'),
  ('SKPD-34', 'Dinas Pariwisata dan Ekonomi Kreatif', 'Disparekraf'),
  ('SKPD-35', 'Dinas Kebudayaan', 'Disbud'),
  ('SKPD-36', 'Dinas Perpustakaan dan Kearsipan', 'Dispusip');
-- Akun admin dibuat oleh aplikasi saat pertama dijalankan (hash scrypt), bukan di skrip SQL.
