# Daftar Kendaraan Dinas

Melihat, mencari, dan mengelola seluruh kendaraan dinas beserta informasi lengkapnya.

## Spesifikasi

### Tujuan
Menyediakan satu halaman daftar kendaraan dinas agar petugas dapat melihat, mencari, dan mengelola seluruh data kendaraan beserta informasi pentingnya dengan cepat.
### Selesai bila
- Halaman menampilkan daftar kendaraan dengan kolom utama: nomor polisi, merek/tipe, jenis, kondisi, dan pemegang.
- Petugas dapat mencari berdasarkan nomor polisi serta menyaring berdasarkan jenis dan status/kondisi kendaraan.
- Setiap baris kendaraan dapat dibuka ke halaman detail dan tersedia aksi tambah, ubah, serta hapus.
- Setelah data ditambah, diubah, atau dihapus, daftar menampilkan data terbaru.
- Bila belum ada data atau hasil pencarian kosong, tampil pesan yang jelas beserta arahan berikutnya.

## Sub-fitur: Cari & Saring

Menemukan kendaraan dengan cepat berdasarkan nomor polisi, jenis, atau statusnya.

### Tujuan
Memudahkan petugas menemukan kendaraan tertentu dengan cepat melalui pencarian dan penyaringan pada daftar kendaraan.
### Selesai bila
- Tersedia kolom pencarian nomor polisi yang memperbarui hasil daftar sesuai kata kunci.
- Tersedia penyaringan jenis kendaraan dan status/kondisi yang dapat dipilih serta dikosongkan kembali.
- Bila tidak ada kendaraan yang cocok, daftar menampilkan pesan kosong yang jelas.

## Sub-fitur: Detail Kendaraan

Melihat informasi lengkap satu kendaraan termasuk kondisi terkininya.

### Tujuan
Menampilkan informasi lengkap satu kendaraan agar petugas dapat memeriksa identitas, kondisi terkini, dan keterkaitannya dengan mudah.
### Selesai bila
- Halaman detail menampilkan nomor polisi, merek, tipe, tahun, warna, jenis kendaraan, dan kondisi terkini.
- Halaman detail menampilkan perangkat daerah pemilik serta pegawai pemegang bila ada; bila tidak ada, statusnya ditandai jelas.
- Tersedia tombol kembali ke daftar dan akses menuju form ubah data kendaraan.

## Sub-fitur: Tambah Kendaraan Baru

Memasukkan data kendaraan dinas yang belum tercatat ke dalam aplikasi.

### Tujuan
Memasukkan data kendaraan dinas baru ke dalam aplikasi agar kendaraan tersebut tercatat dan dapat dikelola selanjutnya.
### Selesai bila
- Form tambah memuat isian utama kendaraan: nomor polisi, merek, tipe, tahun produksi, jenis, kondisi, perangkat daerah, dan pemegang opsional dari pegawai aktif.
- Nomor polisi, nomor rangka, dan nomor mesin yang sudah dipakai ditolak dengan pesan yang jelas; tahun produksi divalidasi pada rentang wajar.
- Setelah penyimpanan berhasil, kendaraan muncul di daftar dan halaman detailnya dapat dibuka.

## Sub-fitur: Ubah & Hapus Data

Memperbaiki atau menghapus data kendaraan yang keliru.

### Tujuan
Memperbaiki data kendaraan yang keliru dan menghapus data yang tidak diperlukan dengan aman.
### Selesai bila
- Form ubah terisi data kendaraan saat ini dan menyimpan perubahan dengan validasi yang sama seperti saat tambah.
- Sebelum menghapus, muncul konfirmasi yang menyebut nomor polisi kendaraan yang akan dihapus.
- Setelah perubahan atau penghapusan, daftar dan detail kendaraan menampilkan kondisi terbaru; kendaraan yang dihapus tidak lagi muncul di daftar.

## Task

### 1. Bangun halaman daftar kendaraan dengan data tiruan

### 2. Tambahkan pencarian nomor polisi dan filter kendaraan

### 3. Tampilkan empty state daftar kendaraan kosong

### 4. Buat halaman detail kendaraan dengan data tiruan

### 5. Buat form tambah kendaraan dengan validasi tiruan

### 6. Buat form ubah kendaraan terisi data tiruan

### 7. Buat dialog konfirmasi hapus kendaraan

### 8. Sinkronkan daftar dan detail setelah aksi tiruan

### 9. Buat tabel kendaraan dan migrasi database

### 10. Buat endpoint daftar kendaraan dengan filter

### 11. Buat endpoint detail kendaraan dengan relasi

### 12. Buat endpoint tambah kendaraan dengan validasi lengkap

### 13. Buat endpoint ubah kendaraan dengan validasi sama

### 14. Buat endpoint hapus kendaraan
