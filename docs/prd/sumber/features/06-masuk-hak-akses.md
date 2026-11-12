# Masuk & Hak Akses

Membatasi siapa saja yang boleh membuka dan mengubah data kendaraan dinas.

## Spesifikasi

### Tujuan
Membatasi siapa saja yang boleh membuka dan mengubah data kendaraan dinas, sehingga hanya petugas berakun resmi instansi yang dapat melihat atau mengubah data aset.

### Selesai bila
- Pengguna yang belum masuk tidak dapat membuka halaman data kendaraan dan diarahkan ke halaman masuk.
- Setiap pengguna masuk dengan email dan kata sandi akun instansinya, dan bila salah mendapat pesan kesalahan yang jelas.
- Setelah masuk, nama pengguna dan perannya tampil di aplikasi, serta tersedia tombol keluar yang mengakhiri sesi.
- Menu dan tombol ubah/hapus hanya muncul untuk peran yang berhak, sedangkan peran lain hanya dapat melihat data.
- Pengguna tanpa hak akses yang mencoba membuka alamat halaman terlarang melihat pesan penolakan, bukan data.

## Sub-fitur: Masuk Akun

Petugas masuk ke aplikasi menggunakan akun instansinya.

### Tujuan
Memungkinkan petugas masuk ke aplikasi memakai akun instansinya agar data kendaraan dinas hanya bisa diakses orang yang berwenang.

### Selesai bila
- Halaman masuk menampilkan kolom email dan kata sandi beserta tombol masuk.
- Bila email atau kata sandi salah, muncul pesan kesalahan yang mudah dipahami dan pengguna tetap di halaman masuk.
- Bila berhasil masuk, pengguna langsung diarahkan ke dashboard dan namanya tampil di aplikasi.
- Tersedia tombol keluar yang mengakhiri sesi dan mengembalikan pengguna ke halaman masuk.

## Sub-fitur: Kelola Pengguna

Mengatur daftar orang yang boleh memakai aplikasi.

### Tujuan
Mengatur daftar orang yang boleh memakai aplikasi beserta status aktifnya, sehingga akses hanya diberikan kepada petugas yang berhak.

### Selesai bila
- Admin dapat melihat daftar pengguna beserta nama, email, peran, dan status aktifnya.
- Admin dapat menambah pengguna baru dengan nama, email, kata sandi awal, dan peran, serta dapat mengubah data dan menonaktifkannya.
- Email yang sudah dipakai tidak bisa didaftarkan ulang dan muncul pesan kesalahan yang jelas.
- Pengguna yang dinonaktifkan tidak dapat masuk ke aplikasi.

## Sub-fitur: Peran & Izin

Membedakan hak pengelola aset dan petugas lapangan.

### Tujuan
Membedakan hak pengelola aset dan petugas lapangan agar perubahan data kendaraan hanya dilakukan pihak yang berwenang.

### Selesai bila
- Setiap akun memiliki satu peran yang jelas: pengelola aset atau petugas lapangan.
- Pengelola aset dapat menambah, mengubah, dan menghapus data, sedangkan petugas lapangan hanya dapat melihat data.
- Tombol tambah, ubah, dan hapus tidak ditampilkan bagi peran yang tidak berhak.
- Bila peran tanpa hak mencoba mengakses tindakan terlarang, muncul pesan penolakan dan data tidak berubah.

## Task

### 1. Bangun halaman masuk dengan data tiruan

### 2. Tampilkan pesan kesalahan login salah

### 3. Buat dashboard tiruan profil dan tombol keluar

### 4. Buat halaman daftar pengguna dengan data tiruan

### 5. Buat form tambah dan ubah pengguna tiruan

### 6. Tampilkan pesan email duplikat pada form pengguna

### 7. Sembunyikan tombol aksi sesuai peran tiruan

### 8. Buat halaman penolakan akses tiruan

### 9. Buat skema dan migrasi tabel pengguna

### 10. Seed akun admin awal untuk masuk

### 11. Implementasikan API masuk email dan kata sandi

### 12. Implementasikan API keluar dan manajemen sesi

### 13. Buat endpoint profil pengguna yang sedang masuk

### 14. Implementasikan API daftar, tambah, ubah, nonaktifkan pengguna

### 15. Validasi email unik dan blokir pengguna nonaktif

### 16. Buat middleware otorisasi berbasis peran pengguna

### 17. Lindungi route data kendaraan dengan pesan penolakan
