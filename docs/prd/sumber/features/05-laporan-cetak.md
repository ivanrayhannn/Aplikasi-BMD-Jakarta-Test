# Laporan & Cetak

Menghasilkan laporan siap pakai tentang kendaraan, pemakaian, dan perawatan.

## Spesifikasi

### Tujuan
Menyediakan satu menu yang menyusun data kendaraan, pemakaian, dan perawatan menjadi laporan siap pakai yang bisa dilihat, dicetak, dan diunduh tanpa menyusun ulang data.

### Selesai bila
- Menu **Laporan & Cetak** menampilkan tiga pilihan jenis laporan: Daftar Kendaraan, Pemakaian, dan Perawatan.
- Setiap laporan tampil sebagai pratinjau di layar lengkap dengan kop instansi (nama & logo), judul laporan, dan tanggal cetak.
- Setiap laporan bisa dicetak dan diunduh sebagai PDF maupun Excel, dengan isi dan angka yang sama seperti pratinjau di layar.
- Penyaringan (mis. periode atau unit) langsung mengubah isi pratinjau tanpa memuat ulang data dari awal.
- Bila tidak ada data untuk ditampilkan, muncul pesan jelas dan tombol cetak/unduh tidak menghasilkan berkas kosong atau rusak.

## Sub-fitur: Laporan Daftar Kendaraan

Menyusun rekapitulasi seluruh kendaraan dalam format siap cetak.

### Tujuan
Menyusun rekapitulasi seluruh kendaraan dinas dalam satu tabel rapi yang siap dicetak.

### Selesai bila
- Tabel memuat sekurangnya nomor polisi, merek/tipe, jenis kendaraan, tahun produksi, kondisi, unit pemilik, dan nama pemegang.
- Pengguna dapat menyaring per unit (perangkat daerah) dan/atau status kondisi, dan hasilnya langsung terlihat di pratinjau.
- Baris ringkasan jumlah kendaraan per kondisi serta total keseluruhan ditampilkan di bawah tabel, dengan format tanggal dan angka yang rapi.

## Sub-fitur: Laporan Pemakaian

Menyusun rekap pemakaian kendaraan dalam periode tertentu.

### Tujuan
Menyusun rekap siapa memakai kendaraan apa dalam periode tertentu agar penanggung jawab pemakaian mudah ditelusuri.

### Selesai bila
- Pengguna memilih tanggal mulai dan tanggal selesai, dan pratinjau hanya menampilkan pemakaian pada rentang tersebut.
- Tiap baris memuat nomor polisi, nama pemakai, unit, tanggal mulai, tanggal selesai, dan status pemakaian (aktif/selesai).
- Pemakaian yang belum berakhir ditampilkan sebagai "Masih berjalan", dan pesan khusus muncul bila tidak ada pemakaian pada periode itu.

## Sub-fitur: Laporan Perawatan

Menyusun rekap biaya dan riwayat servis kendaraan.

### Tujuan
Menyusun rekap riwayat servis beserta biayanya agar total pengeluaran perawatan tiap kendaraan mudah diketahui.

### Selesai bila
- Tabel memuat tanggal servis, kendaraan, jenis perawatan, bengkel, biaya, kondisi setelah servis, dan jadwal servis berikutnya.
- Total biaya per kendaraan dan total biaya keseluruhan ditampilkan dalam format Rupiah.
- Pengguna dapat menyaring per kendaraan dan/atau rentang tanggal servis, dan angka ringkasan ikut menyesuaikan hasil saringan.

## Sub-fitur: Cetak & Unduh

Mencetak atau menyimpan laporan sebagai berkas PDF/Excel.

### Tujuan
Mengubah pratinjau laporan menjadi lembar cetak atau berkas PDF/Excel yang rapi dan siap diserahkan.

### Selesai bila
- Tombol **Cetak** membuka tampilan cetak yang memuat kop instansi, judul laporan, periode, dan tanggal cetak, tanpa menu navigasi aplikasi ikut tercetak.
- Tombol **Unduh PDF** dan **Unduh Excel** menghasilkan berkas dengan nama yang menyebut jenis laporan dan tanggalnya.
- Isi serta angka pada berkas hasil cetak/unduh sama persis dengan pratinjau yang terlihat di layar.

## Task

### 1. Bangun halaman laporan dengan data tiruan

### 2. Buat pratinjau laporan daftar kendaraan tiruan

### 3. Buat pratinjau laporan pemakaian dengan filter tanggal

### 4. Buat pratinjau laporan perawatan dengan ringkasan biaya

### 5. Terapkan gaya cetak laporan tanpa navigasi

### 6. Hubungkan unduh PDF dan Excel ke pratinjau

### 7. Tambahkan empty state dan format laporan

### 8. Buat model dan migrasi pengaturan kop laporan

### 9. Buat service query laporan daftar kendaraan

### 10. Buat endpoint laporan daftar kendaraan terfilter

### 11. Buat endpoint laporan pemakaian per periode

### 12. Buat endpoint laporan perawatan dengan agregasi biaya

### 13. Sediakan endpoint pengaturan kop instansi laporan

### 14. Implementasi ekspor PDF dan Excel di server

### 15. Validasi filter dan data kosong laporan
