# Pengaturan Aplikasi

Menyesuaikan data instansi, kategori, dan pengingat agar sesuai kebutuhan daerah.

## Spesifikasi

### Tujuan
Memungkinkan admin menyesuaikan identitas instansi, pilihan data tetap, dan pengingat agar aplikasi serta laporan sesuai kebutuhan daerah.
### Selesai bila
- Admin dapat membuka halaman Pengaturan dan melihat tiga bagian: Data Instansi, Pilihan Terkendali, dan Pengingat.
- Perubahan yang disimpan langsung tercermin pada kop/pratinjau laporan dan pilihan pada form terkait.
- Hanya pengguna berwenang yang dapat mengubah pengaturan; pengguna lain tidak dapat mengubahnya.
- Setiap penyimpanan menampilkan pesan berhasil atau gagal yang jelas.

## Sub-fitur: Data Instansi

Mengatur nama instansi dan logo yang tampil pada kop laporan.

### Tujuan
Mengatur nama instansi dan logo yang tampil pada kop laporan agar laporan resmi sesuai identitas daerah.
### Selesai bila
- Admin dapat mengisi atau mengubah nama instansi dan mengunggah/mengganti logo, lalu menyimpan.
- Pratinjau kop laporan menampilkan nama dan logo terbaru setelah pengaturan disimpan.
- Bila logo belum ada atau gagal diunggah, muncul pesan jelas dan kop tetap menampilkan nama instansi.

## Sub-fitur: Pilihan Terkendali

Menyediakan pilihan tetap untuk jenis kendaraan, kondisi, golongan, bahan bakar, dan status kepegawaian tanpa tabel kategori terpisah.

### Tujuan
Menyediakan pilihan tetap untuk jenis kendaraan, kondisi, golongan, bahan bakar, dan status kepegawaian agar data yang dimasukkan konsisten.
### Selesai bila
- Admin dapat melihat daftar pilihan yang tersedia untuk kelima kelompok data tersebut dalam satu halaman pengaturan.
- Pilihan yang sama muncul di form kendaraan dan pegawai, serta nilai di luar daftar ditolak dengan pesan jelas.
- Pengguna tidak perlu membuat kategori baru untuk memakai pilihan tersebut.

## Sub-fitur: Pengingat

Mengatur pengingat servis dan pembaruan data kendaraan.

### Tujuan
Mengatur kapan pengingat servis dan pembaruan data kendaraan ditampilkan agar perawatan dan data aset tetap terjaga.
### Selesai bila
- Admin dapat mengatur jumlah hari sebelum jadwal servis untuk memunculkan pengingat.
- Admin dapat mengatur pengingat pembaruan data kendaraan.
- Pengingat yang relevan muncul di dashboard atau daftar kendaraan sesuai pengaturan dan tetap tersimpan setelah pengguna keluar lalu masuk kembali.

## Task

### 1. Bangun halaman Pengaturan dengan data tiruan

### 2. Buat form Data Instansi dan pratinjau kop

### 3. Buat panel Pilihan Terkendali dengan data tiruan

### 4. Hubungkan form ke pilihan terkendali mock

### 5. Buat form Pengingat servis dan pembaruan data

### 6. Tampilkan pengingat mock di dashboard kendaraan

### 7. Tambahkan otorisasi dan pesan simpan mock

### 8. Buat skema pengaturan instansi dan logo

### 9. Buat endpoint instansi dan unggah logo

### 10. Buat konstanta pilihan terkendali lima kelompok data

### 11. Buat endpoint pilihan terkendali dan validasi form

### 12. Buat skema pengaturan pengingat servis dan data

### 13. Buat endpoint baca simpan pengaturan pengingat

### 14. Buat layanan hitung pengingat servis dan pembaruan

### 15. Terapkan otorisasi admin pada endpoint pengaturan

### 16. Terapkan data instansi pada kop laporan

### 17. Standarkan respons sukses gagal endpoint pengaturan
