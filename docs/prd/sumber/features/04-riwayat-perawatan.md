# Riwayat Perawatan

Mencatat servis kendaraan, biaya, dan jadwal perawatan berikutnya agar kondisi tetap terpantau.

## Spesifikasi

### Tujuan
Mencatat setiap servis kendaraan dinas beserta biaya dan jadwal perawatan berikutnya, agar riwayat perawatan rapi, biaya terpantau, dan kondisi kendaraan selalu diketahui.
### Selesai bila
- Pengguna dapat membuka riwayat perawatan sebuah kendaraan dan melihat daftar catatan servisnya (tanggal, jenis perawatan, bengkel, biaya, kondisi setelah servis) dalam urutan terbaru di atas.
- Pengguna dapat menambah catatan perawatan baru, mengubah, dan menghapus catatan yang keliru, dengan konfirmasi sebelum menghapus.
- Setiap catatan perawatan menampilkan biaya dalam format Rupiah (mis. Rp1.250.000) dan tanggal dalam format yang mudah dibaca (mis. 12 Feb 2025).
- Total biaya perawatan tiap kendaraan dan jadwal servis berikutnya terlihat jelas pada tampilan riwayat perawatan kendaraan tersebut.
- Setelah catatan perawatan disimpan, kondisi terkini kendaraan ikut diperbarui sesuai kondisi setelah servis.

## Sub-fitur: Catat Perawatan

Menyimpan catatan servis beserta tanggal dan biayanya.

### Tujuan
Menyimpan catatan servis kendaraan lengkap dengan tanggal pelaksanaan, jenis perawatan, bengkel, dan biayanya.
### Selesai bila
- Pengguna dapat mengisi form catat perawatan pada kendaraan tertentu: tanggal servis, jenis perawatan, deskripsi, bengkel, dan biaya, lalu menyimpannya.
- Catatan yang baru disimpan langsung muncul di daftar riwayat perawatan kendaraan tersebut dengan biaya tampil dalam format Rupiah.
- Bila ada isian wajib yang kosong atau biaya/tanggal tidak wajar, muncul pesan kesalahan yang jelas dan data tidak tersimpan.

## Sub-fitur: Jadwal Servis Berikutnya

Memberi pengingat kapan kendaraan harus diservis lagi.

### Tujuan
Memberi pengingat kapan kendaraan harus diservis lagi agar perawatan tidak terlewat.
### Selesai bila
- Pengguna dapat mengisi tanggal jadwal servis berikutnya saat mencatat perawatan, dan tanggal itu tampil pada riwayat perawatan kendaraan.
- Kendaraan yang jadwal servis berikutnya sudah dekat atau terlewat ditandai mencolok (mis. label "Segera servis" atau "Terlambat") di daftar riwayat perawatan.
- Daftar kendaraan yang perlu diservis dapat dilihat dalam satu tampilan, diurutkan dari jadwal paling dekat.

## Sub-fitur: Rekap Biaya Perawatan

Menampilkan total biaya perawatan tiap kendaraan.

### Tujuan
Menampilkan total biaya perawatan tiap kendaraan agar pengeluaran servis mudah dipantau.
### Selesai bila
- Pada riwayat perawatan sebuah kendaraan tampil total biaya perawatan seluruh catatan servisnya dalam format Rupiah.
- Tersedia tampilan rekap yang mendaftar semua kendaraan beserta jumlah catatan servis dan total biayanya, diurutkan dari biaya terbesar.
- Angka total pada rekap sama persis dengan jumlah biaya catatan servis yang tampil di riwayat kendaraan tersebut.

## Sub-fitur: Kondisi Setelah Servis

Memperbarui status kondisi kendaraan setelah menjalani perawatan.

### Tujuan
Memperbarui status kondisi kendaraan setelah menjalani perawatan agar kondisi terkini selalu akurat.
### Selesai bila
- Saat mencatat perawatan, pengguna dapat memilih kondisi kendaraan setelah servis (baik, rusak ringan, rusak berat).
- Setelah catatan disimpan, kondisi terkini kendaraan berubah sesuai pilihan tersebut dan tampil pada detail serta daftar kendaraan.
- Kondisi setelah servis dari catatan terbaru tampil pada riwayat perawatan sehingga perubahan kondisi mudah ditelusuri.

## Task

### 1. Bangun halaman riwayat perawatan dan ringkasan biaya

### 2. Buat form catat dan ubah perawatan

### 3. Hubungkan aksi simpan ubah hapus dengan konfirmasi

### 4. Terapkan format Rupiah tanggal dan badge jadwal

### 5. Tampilkan kondisi terkini kendaraan setelah servis

### 6. Buat halaman daftar kendaraan perlu servis

### 7. Buat tampilan rekap biaya perawatan kendaraan

### 8. Buat skema dan migrasi catatan perawatan

### 9. Buat API CRUD riwayat perawatan kendaraan

### 10. Perbarui kondisi kendaraan saat catatan perawatan disimpan

### 11. Buat API daftar kendaraan perlu servis

### 12. Buat API rekap biaya perawatan per kendaraan

### 13. Tambahkan validasi payload dan error API perawatan
