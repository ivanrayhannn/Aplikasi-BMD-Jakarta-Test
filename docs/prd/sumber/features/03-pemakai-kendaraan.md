# Pemakai Kendaraan

Mencatat pegawai yang bertanggung jawab atas penggunaan setiap kendaraan dinas.

## Spesifikasi

### Tujuan
Memungkinkan petugas mencatat pegawai yang bertanggung jawab atas pemakaian kendaraan dinas, sehingga jelas siapa memakai kendaraan apa dan sejak kapan — sekaligus menjadi sumber data untuk dashboard "Kendaraan Sedang Dipakai".

### Selesai bila
- Petugas dapat menambah, melihat, mengubah, dan menghapus data pegawai yang bisa ditunjuk sebagai pemakai kendaraan, lengkap dengan pencarian dan penyaringan status kepegawaian.
- Petugas dapat menautkan satu kendaraan dinas ke satu pegawai pemakai, dan hasilnya langsung tampil sebagai "Kendaraan Sedang Dipakai" di dashboard.
- Petugas dapat menutup pemakaian sehingga terbentuk riwayat berisi siapa memakai kendaraan apa dalam periode kapan.
- Kendaraan yang sudah punya pemakaian aktif tidak bisa ditautkan lagi ke pegawai lain tanpa menutup pemakaian sebelumnya, dan pesan penolakannya jelas.
- Setiap layar pemakai kendaraan terdokumentasi berupa screenshot di workbook Excel dan seluruh endpoint terkait tersedia di koleksi Postman.

## Sub-fitur: Daftar Pegawai

Menyimpan data pegawai yang bisa ditunjuk sebagai pemakai kendaraan.

### Tujuan
Menyediakan daftar pegawai yang datanya lengkap dan valid, sehingga dapat dipilih sebagai penanggung jawab kendaraan dinas.

### Selesai bila
- Petugas dapat menambah, melihat, mengubah, dan menghapus data pegawai dengan field wajib (NIP 18 digit, nama, jabatan, unit kerja) serta pilihan golongan, jenis kelamin, dan status kepegawaian.
- Daftar pegawai dapat dicari berdasarkan nama/NIP dan disaring berdasarkan status kepegawaian serta unit kerja, dengan tampilan tabel yang rapi termasuk status aktif/tidaknya pegawai.
- NIP yang sudah terdaftar ditolak dengan pesan jelas, dan pegawai yang masih memegang kendaraan tidak bisa dihapus tanpa penanganan yang dijelaskan ke petugas.

## Sub-fitur: Tautkan Pemakai

Menghubungkan satu kendaraan dengan pegawai yang memakainya.

### Tujuan
Menghubungkan satu kendaraan dinas dengan pegawai yang memakainya, agar tanggung jawab pemakaian tercatat dan tampil di dashboard.

### Selesai bila
- Petugas dapat memilih satu kendaraan dan satu pegawai lalu menyimpan penautan, dengan tanggal mulai pemakaian terisi dan status tercatat sebagai aktif.
- Kendaraan yang sudah memiliki pemakaian aktif tidak dapat ditautkan lagi; muncul pesan yang menjelaskan bahwa pemakaian sebelumnya harus ditutup lebih dulu.
- Setelah penautan tersimpan, kendaraan tersebut langsung muncul pada bagian "Kendaraan Sedang Dipakai" di dashboard beserta nama pegawai pemakainya.

## Sub-fitur: Riwayat Pemakaian

Melihat catatan siapa memakai kendaraan apa dan dalam periode kapan.

### Tujuan
Menampilkan catatan pemakaian kendaraan dari waktu ke waktu, sehingga dapat ditelusuri siapa memakai kendaraan apa dan pada periode kapan.

### Selesai bila
- Petugas dapat menutup pemakaian yang sedang berjalan dengan mengisi tanggal selesai, dan statusnya berubah menjadi selesai.
- Riwayat pemakaian menampilkan daftar berisi kendaraan, nama pegawai, tanggal mulai, tanggal selesai, dan status, dapat disaring per kendaraan atau per pegawai.
- Riwayat pemakaian dapat dilihat dari dua sisi: dari halaman kendaraan (siapa saja yang pernah memakainya) dan dari halaman pegawai (kendaraan apa saja yang pernah dipakainya).

## Task

### 1. Bangun halaman utama Pemakai Kendaraan

### 2. Buat tabel pegawai dengan pencarian filter

### 3. Buat form tambah ubah pegawai

### 4. Buat hapus pegawai dengan cek pemakaian

### 5. Buat form tautkan kendaraan ke pegawai

### 6. Tampilkan panel Kendaraan Sedang Dipakai

### 7. Buat halaman riwayat pemakaian kendaraan

### 8. Buat aksi tutup pemakaian kendaraan

### 9. Tampilkan riwayat dari kendaraan dan pegawai

### 10. Siapkan screenshot layar Pemakai Kendaraan

### 11. Buat skema tabel pegawai pemakai

### 12. Buat endpoint CRUD pegawai dengan validasi NIP

### 13. Buat endpoint daftar pegawai dengan filter

### 14. Buat skema tabel pemakaian kendaraan

### 15. Buat endpoint tautkan pemakai kendaraan

### 16. Buat endpoint tutup pemakaian dan riwayat

### 17. Buat endpoint dashboard Kendaraan Sedang Dipakai

### 18. Susun koleksi Postman endpoint Pemakai Kendaraan
