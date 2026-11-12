# Manual setup SI-KDO

Langkah dari mesin bersih sampai aplikasi terverifikasi. Perintah diuji di Linux; di Windows jalankan di PowerShell atau Git Bash.

## 1. Prasyarat

| Kebutuhan | Versi | Cek |
|---|---|---|
| Node.js | 22.5 atau lebih baru (memakai modul bawaan `node:sqlite`) | `node -v` |
| npm | Ikut Node.js | `npm -v` |
| Git | Apa saja | `git --version` |

Tidak perlu server database: SQLite tersimpan sebagai satu berkas di `data/kdo.db`.

## 2. Ambil kode dan pasang dependensi

```bash
git clone -b claude/dreamy-pascal-qxpvy1 https://github.com/ivanrayhannn/Aplikasi-BMD-Jakarta-Test.git
```

```bash
cd Aplikasi-BMD-Jakarta-Test
```

```bash
npm ci
```

## 3. Jalankan

Untuk uji coba (UAT), dengan data uji pegawai dan kendaraan:

```bash
npm start
```

Untuk produksi, tanpa data uji (hanya 36 SKPD dan satu akun admin):

```bash
SEED_SAMPLE=0 DB_FILE=/var/lib/si-kdo/kdo.db PORT=8080 npm start
```

Di PowerShell:

```bash
$env:SEED_SAMPLE="0"; $env:PORT="8080"; npm start
```

| Variabel | Bawaan | Fungsi |
|---|---|---|
| `PORT` | `3000` | Port HTTP |
| `DB_FILE` | `data/kdo.db` | Lokasi berkas database |
| `SEED_SAMPLE` | aktif | `0` = database baru tanpa data uji |

Data awal hanya dibuat saat database masih kosong. Untuk mengulang dari awal, hentikan server lalu hapus berkas database.

## 4. Masuk pertama kali

Buka `http://localhost:3000` dan masuk sebagai `admin@kdo.test` dengan sandi `admin12345`. Pada database produksi, segera:

1. Buka **Kelola Pengguna**, ubah email dan kata sandi admin, lalu tambahkan akun lain.
2. Buka **Pengaturan**, isi nama instansi, alamat, dan logo untuk kop laporan.

Bila data uji aktif, aplikasi menampilkan label "Lingkungan uji (UAT)" dan halaman masuk menampilkan akun uji coba (`petugas@kdo.test` / `petugas12345` untuk peran Petugas Lapangan).

## 5. Verifikasi

```bash
npm test
```

Hasil yang diharapkan: seluruh uji lulus (45 uji).

Uji kontrak API dengan Postman atau Newman pada server yang baru dijalankan dengan database baru berisi data contoh:

```bash
npx newman@6.2.1 run docs/postman/KDO.postman_collection.json -e docs/postman/KDO-local.postman_environment.json
```

Hasil yang diharapkan: 68 permintaan, 0 gagal.

Uji UI end-to-end (butuh Playwright dan Chromium terpasang), juga pada database baru:

```bash
npm run test:e2e
```

## 6. Demo statis (GitHub Pages)

```bash
npm run build:pages
```

Hasilnya di `dist/`. Workflow `.github/workflows/pages.yml` menjalankan uji lalu menerbitkan `dist/` ke GitHub Pages pada setiap push. Aktifkan sekali di **Settings, Pages, Source: GitHub Actions**. Pada mode demo, API berjalan di browser dan data hanya tersimpan di browser pengunjung.

## 7. Jalur MySQL 8.4 (Laragon)

PRD merekomendasikan MySQL 8.4 dengan database `kdo_db`. Rancangan skema setaranya tersedia, tetapi **aplikasi saat ini belum terhubung ke MySQL** (lihat PRD bagian 11, K-1, dan pertanyaan Q-1).

1. Jalankan MySQL di Laragon (Start All).
2. Buat database dan tabel:

```bash
mysql -u root -p < db/mysql/kdo_master_tables.sql
```

3. Periksa: `SHOW TABLES FROM kdo_db;` menampilkan 9 tabel, dan `SELECT COUNT(*) FROM kdo_db.perangkat_daerah;` menghasilkan 36.

DDL ini belum dijalankan terhadap server MySQL di lingkungan pengembangan; mohon laporkan bila ada error saat impor.

## 8. Pemecahan masalah

| Gejala | Penyebab | Solusi |
|---|---|---|
| `Cannot find module 'node:sqlite'` atau `DatabaseSync is not a constructor` | Node.js lebih lama dari 22.5 | Pasang Node.js 22 LTS atau lebih baru |
| `EADDRINUSE` saat `npm start` | Port 3000 dipakai aplikasi lain | Jalankan dengan `PORT=3100 npm start` |
| Browser menampilkan aplikasi lain di localhost | Server lain masih berjalan di port yang sama | Hentikan server lain, atau pakai port berbeda dan cek pesan "Aplikasi KDO berjalan di ..." di terminal |
| `attempt to write a readonly database` | Berkas database dihapus saat server berjalan, atau folder tidak dapat ditulis | Hentikan server, periksa izin folder `DB_FILE`, jalankan ulang |
| Akun petugas uji tidak bisa masuk | Database dibuat dengan `SEED_SAMPLE=0` | Hanya `admin@kdo.test` yang tersedia; buat akun lain di Kelola Pengguna |
| Newman gagal di folder awal | Database bukan database baru (ID data uji bergeser) | Hentikan server, hapus `data/kdo.db`, jalankan ulang |
| Kop PDF/Excel tanpa logo | Logo berformat SVG | Unggah logo PNG atau JPG |
