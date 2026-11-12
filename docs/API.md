# REST API SI-KDO

Base URL: `http://localhost:3000/api/v1`. Semua endpoint selain `POST /auth/login` wajib header `Authorization: Bearer <token>`.

## Format respons

Sukses:

```json
{ "data": { }, "meta": { "page": 1, "per_page": 20, "total": 42, "total_pages": 3 } }
```

`meta` hanya ada pada daftar berpaginasi dan laporan.

Gagal:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Data yang dikirim belum valid", "details": { "nip": "NIP harus 18 digit angka" } } }
```

| Status | `code` | Kapan |
|---|---|---|
| 400 | `BAD_REQUEST` | Body JSON rusak |
| 401 | `UNAUTHORIZED` | Belum masuk, sesi kedaluwarsa, email/sandi salah, akun nonaktif |
| 403 | `FORBIDDEN` | Peran petugas mencoba mengubah data, atau membuka endpoint khusus admin |
| 404 | `NOT_FOUND` | Data atau endpoint tidak ada |
| 409 | `CONFLICT` | Bentrok aturan relasi: hapus perangkat daerah yang masih dipakai, pemakaian aktif ganda, dan sejenisnya |
| 422 | `VALIDATION_ERROR` | Field wajib kosong, format salah, nilai unik sudah dipakai, nilai ENUM di luar daftar. `details` berisi pesan per field |

## Paginasi dan penyaringan

Semua daftar menerima `page` (mulai 1) dan `per_page` (bawaan 20, maksimal 1000). Parameter kosong diabaikan.

## Endpoint

### Autentikasi

| Metode | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | Publik | Body `{ email, password }` → `{ token, expires_in, user }` |
| POST | `/auth/logout` | Masuk | Mengakhiri sesi token ini |
| GET | `/auth/me` | Masuk | Profil pengguna aktif |
| GET | `/referensi` | Masuk | Semua pilihan terkendali (ENUM) |

### Data master

| Metode | Path | Akses | Parameter / catatan |
|---|---|---|---|
| GET | `/perangkat-daerah` | Masuk | `q` (kode, nama, singkatan), `is_aktif` (`1`/`0`) |
| GET | `/perangkat-daerah/{id}` | Masuk | Termasuk daftar `pns` dan `kdo` milik unit |
| POST | `/perangkat-daerah` | Admin | Wajib `kode`, `nama_dinas` |
| PUT | `/perangkat-daerah/{id}` | Admin | Field yang tidak dikirim tidak berubah |
| DELETE | `/perangkat-daerah/{id}` | Admin | `409` bila masih punya PNS/KDO; `details` berisi jumlahnya |
| GET | `/pns` | Masuk | `q` (nama, NIP, jabatan), `status_kepegawaian`, `perangkat_daerah_id` |
| GET | `/pns/{id}` | Masuk | Termasuk `kdo_dipegang` dan `riwayat_pemakaian` |
| POST | `/pns` | Admin | Wajib `nip`, `nama_pegawai`, `jabatan`, `perangkat_daerah_id` |
| PUT | `/pns/{id}` | Admin | `409` bila status diubah dari aktif saat masih memegang kendaraan |
| DELETE | `/pns/{id}` | Admin | Pemakaian aktif ditutup, `kdo.pemegang_pns_id` menjadi `NULL`; respons `{ id, kdo_dilepas }` |
| GET | `/kdo` | Masuk | `q`, `kondisi`, `jenis_kendaraan`, `perangkat_daerah_id`, `is_aktif`, `tanpa_pemegang=1` |
| GET | `/kdo/{id}` | Masuk | Termasuk `pemakaian_aktif`, `riwayat_pemakaian`, `perawatan_ringkas` |
| POST | `/kdo` | Admin | Wajib `nomor_polisi`, `merek`, `tahun_produksi`, `jenis_kendaraan`, `nomor_rangka`, `nomor_mesin`, `perangkat_daerah_id`. `pemegang_pns_id` opsional (membuka pemakaian) |
| PUT | `/kdo/{id}` | Admin | `409` bila mengganti pemegang atau menonaktifkan saat pemakaian aktif |
| DELETE | `/kdo/{id}` | Admin | Riwayat ikut terhapus; respons menyebut jumlahnya |

### Operasional

| Metode | Path | Akses | Parameter / catatan |
|---|---|---|---|
| GET | `/pemakaian` | Masuk | `kdo_id`, `pns_id`, `status`, `perangkat_daerah_id`, `q` |
| GET | `/pemakaian/{id}` | Masuk | |
| POST | `/pemakaian` | Admin | Tautkan pemakai: `{ kdo_id, pns_id, tanggal_mulai, keterangan? }`. `409` bila ada pemakaian aktif, `422` bila PNS tidak aktif |
| POST | `/pemakaian/{id}/selesai` | Admin | Tutup pemakaian: `{ tanggal_selesai, keterangan? }` |
| GET | `/perawatan` | Masuk | `kdo_id`, `jenis_perawatan`, `q`; `meta.ringkasan` berisi jumlah dan total biaya untuk filter yang sama |
| GET | `/perawatan/jadwal` | Masuk | Kendaraan dengan jadwal servis berikutnya + `status_jadwal` (`terlambat`/`segera`/`terjadwal`); `perlu_servis=1` hanya yang mendesak |
| GET | `/perawatan/rekap` | Masuk | Total biaya per kendaraan, urut terbesar |
| GET | `/perawatan/{id}` | Masuk | |
| POST | `/perawatan` | Admin | `{ kdo_id, tanggal_servis, jenis_perawatan, biaya, kondisi_setelah, deskripsi?, bengkel?, jadwal_berikutnya? }`; kondisi kendaraan ikut diperbarui |
| PUT | `/perawatan/{id}` | Admin | |
| DELETE | `/perawatan/{id}` | Admin | |
| GET | `/dashboard` | Masuk | Total aset, kondisi, sedang dipakai, aset terbaru, pengingat |

### Laporan

Respons laporan berisi baris data dan `meta` (kop instansi, tanggal cetak, periode, ringkasan).

| Metode | Path | Parameter |
|---|---|---|
| GET | `/laporan/kendaraan` | `perangkat_daerah_id`, `kondisi`, `jenis_kendaraan`, `is_aktif` (bawaan `1`) |
| GET | `/laporan/pemakaian` | `dari`, `sampai` (YYYY-MM-DD), `perangkat_daerah_id`. Pemakaian yang beririsan dengan periode |
| GET | `/laporan/perawatan` | `kdo_id`, `dari`, `sampai` |

### Administrasi

| Metode | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/pengguna` | Admin | `q`, `role` |
| GET | `/pengguna/{id}` | Admin | |
| POST | `/pengguna` | Admin | `{ nama, email, role, password, pns_id?, is_active? }` |
| PUT | `/pengguna/{id}` | Admin | `password` opsional. Menonaktifkan akun mencabut sesinya |
| GET | `/pengaturan` | Masuk | Data instansi, pengingat, dan `pilihan` (ENUM) |
| PUT | `/pengaturan` | Admin | `{ nama_instansi, alamat?, logo_url? (data URL PNG/JPG/SVG ≤ 300 KB), pengingat_servis_hari, pengingat_pembaruan_hari }` |
| GET | `/log-aktivitas` | Admin | `entitas`, `aksi`; 50 per halaman |

## Menguji dengan Postman

1. Impor `docs/postman/KDO.postman_collection.json` dan `docs/postman/KDO-local.postman_environment.json`.
2. Pilih environment **KDO local**, jalankan server dengan database baru berisi data contoh (`rm -rf data && npm start`).
3. Jalankan seluruh koleksi dengan Collection Runner. Folder diurutkan: Auth → Perangkat Daerah → PNS → KDO → Pemakaian → Perawatan → Laporan & Dashboard → Hak Akses → Pengguna & Pengaturan → Penutup. Token dan ID hasil Create tersimpan otomatis ke variabel.

Dari terminal, dengan Newman:

```bash
npx newman@6.2.1 run docs/postman/KDO.postman_collection.json -e docs/postman/KDO-local.postman_environment.json
```
