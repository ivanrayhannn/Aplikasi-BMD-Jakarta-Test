# Data Master (Fase 0)

CRUD tiga entitas master — perangkat_daerah, pns, dan kdo — sebagai fitur utama dan fondasi seluruh fitur lain, lengkap dengan dokumentasi Postman dan workbook screenshot.

## Spesifikasi

### Tujuan
Menyediakan satu tempat untuk mengelola `perangkat_daerah`, `pns`, dan `kdo` (skema: `kdo_master_tables.sql`, MySQL 8.4 `kdo_db`) sebagai fondasi agar dashboard, pemakaian, perawatan, dan laporan membaca data yang sama.

### Dikerjakan lebih dulu (Fase 0)
Fitur ini adalah fitur utama dan dikerjakan sebelum Fase 1 Dashboard, karena fitur lain hanya membaca data master.

### Cakupan
- REST API CRUD penuh untuk ketiga entitas: `GET /api/v1/{entitas}`, `GET /api/v1/{entitas}/{id}`, `POST`, `PUT/PATCH`, `DELETE`, dengan parameter pencarian, filter, dan paginasi.
- Antarmuka CRUD: daftar + pencarian/filter, form tambah/ubah, halaman detail, dialog hapus, penanda data nonaktif, dan pesan validasi per field.
- Aturan integritas: field unik (`kode`, `nama_dinas`, `nip`, `nomor_polisi`, `nomor_rangka`, `nomor_mesin`) ditolak `422` dengan nama field; hapus perangkat daerah yang masih punya `pns`/`kdo` ditolak `409`; `kdo.pemegang_pns_id` memakai `ON DELETE SET NULL`; pemegang wajib PNS `status_kepegawaian = 'aktif'`.
- Seed data awal PD-001 DISDIK, PD-002 DINKES, PD-003 PUPR.
- Dokumentasi: koleksi Postman + environment `local`, workbook Excel gaya Crossdock (screenshot per alur), README, `AGENTS.md`, dan `docs/SETUP.md`.

### Selesai bila
- Ketiga entitas dapat ditambah, dilihat, diubah, dan dihapus dari UI maupun Postman, dengan respons konsisten `{ data, meta }` / `{ error: { code, message } }`.
- Setiap daftar punya pencarian dan penyaring yang merespons dalam hitungan detik.
- Data ganda atau format salah ditolak dengan kode status dan pesan yang menyebut field bermasalah.
- Hubungan antar entitas terlihat di layar dan penghapusan berelasi ditolak/ditangani sesuai aturan di atas.
- Koleksi Postman berjalan berurutan dari awal sampai akhir, dan setiap layar data master punya entri screenshot di workbook Excel.
- README, `AGENTS.md`, dan `docs/SETUP.md` memuat relasi entitas, daftar endpoint, dan langkah setup yang bisa diikuti dari nol.

## Sub-fitur: CRUD Perangkat Daerah

CRUD tabel perangkat_daerah lewat UI dan API, dengan kode/nama_dinas unik, pencarian, filter is_aktif, dan penolakan hapus bila masih dipakai PNS atau KDO.

### Tujuan
Petugas dapat mengelola daftar unit kerja pemilik aset, sehingga setiap PNS dan kendaraan punya perangkat daerah yang jelas.

### Data
Tabel `perangkat_daerah`: `kode` (VARCHAR(20), unik), `nama_dinas` (VARCHAR(150), unik), `singkatan`, `alamat`, `no_telepon`, `email`, `is_aktif` (default 1). Seed: PD-001 DISDIK, PD-002 DINKES, PD-003 PUPR.

### Endpoint
`GET /api/v1/perangkat-daerah` (q, is_aktif, page) · `GET /api/v1/perangkat-daerah/{id}` · `POST` · `PUT /{id}` · `DELETE /{id}`.

### Selesai bila
- Form tambah/ubah memuat kode, nama dinas, singkatan, alamat, telepon, email, dan status aktif, dengan validasi format email/telepon di satu tempat.
- Daftar dapat dicari berdasarkan kode/nama, disaring status aktif, dan data nonaktif punya penanda visual yang jelas.
- `kode` atau `nama_dinas` yang sudah dipakai ditolak `422` dengan pesan yang menyebut field-nya.
- `DELETE` untuk perangkat daerah yang masih punya `pns`/`kdo` ditolak `409` beserta jumlah data penghalang.
- Halaman detail menampilkan daftar PNS dan kendaraan milik unit tersebut.

## Sub-fitur: CRUD PNS

CRUD tabel pns lewat UI dan API: NIP 18 digit unik, ENUM golongan I/a–IV/e, unit kerja wajib, filter status_kepegawaian, dan penanganan hapus dengan SET NULL pada pemegang kendaraan.

### Tujuan
Petugas dapat mengelola data pegawai calon pemegang kendaraan beserta unit kerjanya, agar penanggung jawab kendaraan selalu dapat ditelusuri.

### Data
Tabel `pns`: `nip` (CHAR(18), unik), `nama_pegawai`, `jabatan`, `golongan` (ENUM I/a–IV/e), `pangkat`, `perangkat_daerah_id` (FK), `jenis_kelamin` (ENUM L/P), `no_hp`, `email`, `status_kepegawaian` (ENUM aktif/pensiun/mutasi/nonaktif, default aktif).

### Endpoint
`GET /api/v1/pns` (q, status_kepegawaian, perangkat_daerah_id, page) · `GET /api/v1/pns/{id}` · `POST` · `PUT /{id}` · `DELETE /{id}`.

### Selesai bila
- Form memakai dropdown golongan, jenis kelamin, status kepegawaian (ENUM) dan dropdown perangkat daerah yang tersedia — tanpa input bebas.
- Daftar dapat dicari berdasarkan nama/NIP dan disaring status kepegawaian serta unit kerja.
- NIP bukan 18 digit atau sudah terdaftar ditolak `422` sebelum tersimpan, dengan pesan per field.
- `DELETE` PNS berhasil walau masih memegang kendaraan: `kdo.pemegang_pns_id` menjadi `NULL` dan perubahan itu terlihat di layar kendaraan.
- Halaman detail PNS menampilkan kendaraan yang sedang dipegang dan riwayat pemakaiannya.

## Sub-fitur: CRUD Kendaraan Dinas (KDO)

CRUD tabel kdo lewat UI dan API: identitas, dokumen (BPKB/STNK/pajak), nilai perolehan, unit pemilik, dan pemegang PNS opsional; nomor polisi/rangka/mesin unik.

### Tujuan
Petugas dapat mengelola seluruh kendaraan dinas operasional beserta unit pemilik dan pemegangnya, sehingga jumlah dan identitas aset selalu akurat.

### Data
Tabel `kdo`: identitas (`nomor_polisi` unik, `merek`, `tipe`, `tahun_produksi` 1980–2100, `warna`, `jenis_kendaraan` ENUM, `isi_silinder_cc`, `bahan_bakar` ENUM), kondisi (`kondisi` ENUM baik/rusak_ringan/rusak_berat), legalitas (`nomor_rangka` unik, `nomor_mesin` unik, `nomor_bpkb`, `masa_berlaku_stnk`, `tanggal_pajak`, `tanggal_perolehan`), nilai (`nilai_perolehan` DECIMAL(15,2), `kode_barang_aset`), relasi (`perangkat_daerah_id` FK wajib, `pemegang_pns_id` FK opsional), `keterangan`, `is_aktif`.

### Endpoint
`GET /api/v1/kdo` (q, kondisi, jenis_kendaraan, perangkat_daerah_id, is_aktif, page) · `GET /api/v1/kdo/{id}` · `POST` · `PUT /{id}` · `DELETE /{id}`.

### Selesai bila
- Form dikelompokkan per bagian (identitas, legalitas, nilai & aset, penempatan) dengan ENUM sebagai dropdown dan tanggal memakai date picker.
- Dropdown pemegang hanya berisi PNS `aktif`, dan pemegang dapat dikosongkan.
- `nomor_polisi`/`nomor_rangka`/`nomor_mesin` ganda, tahun di luar 1980–2100, atau PNS nonaktif sebagai pemegang ditolak `422` dengan field yang jelas.
- Daftar dapat dicari (nomor polisi/merek/tipe) dan disaring kondisi, jenis, unit, serta status aktif.
- Halaman detail menampilkan seluruh atribut termasuk status jatuh tempo STNK/pajak dan tautan ke unit serta pemegang.

## Sub-fitur: Relasi & Integritas Data Master

Menampilkan relasi perangkat daerah → pns → kdo dan menegakkan integritasnya di basis data maupun API (409 saat hapus unit terpakai, SET NULL saat hapus pemegang).

### Tujuan
Menjaga hubungan `perangkat_daerah 1─< pns`, `perangkat_daerah 1─< kdo`, dan `pns 1─< kdo` tetap konsisten: tidak ada data menggantung dan tidak ada penghapusan yang menghilangkan riwayat.

### Aturan yang ditegakkan
- Foreign key aktif di MySQL (`kdo_master_tables.sql`), divalidasi juga di level API agar pesan kesalahan ramah.
- Hapus `perangkat_daerah` yang masih punya `pns`/`kdo` → `409 CONFLICT`, pesan menyebut jumlah PNS dan kendaraan penghalang.
- Hapus `pns` yang masih memegang kendaraan → berhasil, `kdo.pemegang_pns_id` menjadi `NULL` (`ON DELETE SET NULL`).
- Menunjuk PNS `status_kepegawaian != 'aktif'` sebagai pemegang → `422`.
- Satu kendaraan maksimal punya satu pemakaian aktif pada `kdo_pemakaian`.

### Selesai bila
- Detail perangkat daerah menampilkan daftar PNS dan kendaraan miliknya; detail PNS menampilkan kendaraan yang dipegang.
- Daftar kendaraan menandai kendaraan tanpa pemegang dan menyediakan filter "belum ada pemegang".
- Semua penolakan muncul sebagai dialog/pesan yang menjelaskan alasan dan langkah perbaikan, bukan error mentah.
- Ada uji Postman untuk tiap aturan di atas, termasuk kasus `409`, `422`, dan pemegang menjadi `NULL`.

## Sub-fitur: Bukti Dokumentasi (Postman, Excel, README)

Workbook Excel gaya Crossdock untuk screenshot frontend, koleksi Postman untuk backend, serta README, AGENTS.md, dan docs/SETUP.md yang terstruktur.

### Tujuan
Menyediakan bukti dokumentasi yang bisa diperiksa dan diserahkan: frontend lewat screenshot di Excel, backend lewat Postman, dan onboarding lewat README/`AGENTS.md`/`docs/SETUP.md`.

### Artefak
- `docs/screenshots/KDO-Screenshots.xlsx` — satu lembar per alur (perangkat daerah, PNS, KDO, relasi/hapus), kolom: No, Langkah, Aksi, Hasil yang Diharapkan, URL Halaman; gambar ditempel *Place in Cell*.
- `docs/postman/KDO.postman_collection.json` + `KDO-local.postman_environment.json` — folder per entitas (List, Detail, Create, Update, Delete, Kasus Error), memakai variabel `baseUrl`, `{{id}}` hasil Create, dan test script pemeriksa status code.
- `README.md` — gambaran aplikasi, diagram relasi tiga entitas, tabel endpoint, cara menjalankan singkat.
- `AGENTS.md` — konvensi penamaan, struktur folder, format respons/error, dan kewajiban memperbarui dokumentasi setiap menambah endpoint.
- `docs/SETUP.md` — manual setup terstruktur: Laragon → buat `kdo_db` → `.env` → migrasi → seed PD-001…PD-003 → jalankan → verifikasi Postman, plus bagian troubleshooting.

### Selesai bila
- Workbook Excel dapat dibuka dengan gambar terlihat di dalam sel, dan setiap layar CRUD data master punya minimal satu baris terdokumentasi.
- Koleksi Postman berjalan berurutan dari Create sampai Delete tanpa gagal pada environment `local`, termasuk uji kasus `409` dan `422`.
- Setup dari nol mengikuti `docs/SETUP.md` berhasil di mesin bersih tanpa langkah tak terdokumentasi.
- README dan `AGENTS.md` konsisten dengan kode yang ada (tidak ada endpoint terdokumentasi yang hilang atau sebaliknya).

## Task

### 1. Bangun halaman Data Master dengan data tiruan

### 2. Buat daftar perangkat daerah dengan pencarian

### 3. Buat form tambah ubah perangkat daerah

### 4. Buat daftar PNS dengan filter status

### 5. Buat form tambah ubah PNS

### 6. Buat daftar kendaraan dinas dengan pencarian

### 7. Buat form tambah ubah kendaraan dinas

### 8. Buat detail perangkat daerah dan PNS

### 9. Terapkan dialog hapus dengan penolakan relasi

### 10. Poles penanda nonaktif dan pesan validasi

### 11. Buat skema dan migrasi tabel data master

### 12. Buat endpoint CRUD perangkat daerah

### 13. Buat endpoint CRUD PNS dengan validasi NIP

### 14. Buat endpoint CRUD kendaraan dinas

### 15. Buat endpoint detail relasi data master

### 16. Terapkan aturan hapus data master berelasi

### 17. Sediakan seed data contoh data master

### 18. Susun koleksi Postman endpoint data master

### 19. Buat workbook Excel dokumentasi layar data master
