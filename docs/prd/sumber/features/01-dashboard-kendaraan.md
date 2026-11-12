# Dashboard Kendaraan

Melihat ringkasan total aset, kendaraan yang sedang dipakai, dan kondisi terkini dalam satu layar.

## Spesifikasi

### Tujuan
Memberi petugas gambaran cepat kondisi seluruh kendaraan dinas dalam satu layar, sehingga total aset, kendaraan yang sedang dipakai, kondisi terkini, dan aset terbaru langsung terlihat tanpa membuka menu lain.
### Selesai bila
- Halaman dashboard menampilkan empat bagian sekaligus: total aset, kendaraan sedang dipakai, status kondisi, dan aset terbaru.
- Semua angka dan daftar di dashboard berasal dari data kendaraan yang sama dengan menu Daftar Kendaraan (tidak ada selisih angka).
- Setiap bagian menampilkan keadaan kosong yang jelas (mis. teks "Belum ada data kendaraan") saat datanya belum tersedia.
- Dashboard dapat dibuka hanya setelah pengguna masuk, dan tetap tampil rapi pada layar laptop maupun desktop lebar.

## Sub-fitur: Ringkasan Total Aset

Menampilkan jumlah seluruh kendaraan dinas yang tercatat.

### Tujuan
Menampilkan jumlah seluruh kendaraan dinas yang tercatat agar petugas langsung tahu skala aset yang dikelola.
### Selesai bila
- Angka total aset tampil besar dan menonjol di bagian atas dashboard.
- Angka berubah otomatis mengikuti data terkini setelah kendaraan ditambah atau dihapus.
- Angka ditampilkan dalam format yang mudah dibaca (mis. 1.250) dengan label jelas "Total Kendaraan Dinas".

## Sub-fitur: Kendaraan Sedang Dipakai

Menampilkan daftar kendaraan yang sedang digunakan beserta nama pemakainya.

### Tujuan
Menampilkan daftar kendaraan yang sedang digunakan beserta nama pemakainya agar petugas tahu siapa memegang kendaraan apa.
### Selesai bila
- Daftar menampilkan minimal nomor polisi, merk/tipe, dan nama pegawai pemakai untuk setiap kendaraan yang sedang dipakai.
- Hanya kendaraan dengan pemakaian berstatus aktif yang muncul di daftar ini.
- Bila tidak ada kendaraan yang sedang dipakai, tampil pesan kosong yang jelas (mis. "Tidak ada kendaraan sedang dipakai").

## Sub-fitur: Status Kondisi Sekilas

Menunjukkan berapa kendaraan dalam kondisi baik, perlu servis, atau rusak.

### Tujuan
Menunjukkan sebaran kondisi kendaraan (baik, perlu servis, rusak) agar petugas cepat mengetahui kendaraan mana yang butuh perhatian.
### Selesai bila
- Tampil tiga ringkasan terpisah: jumlah kendaraan kondisi baik, perlu servis/rusak ringan, dan rusak berat.
- Setiap ringkasan memakai label dan warna pembeda yang konsisten (mis. hijau untuk baik, kuning untuk perlu servis, merah untuk rusak).
- Jumlah ketiga kategori sama dengan total aset yang ditampilkan di dashboard.

## Sub-fitur: Aset Terbaru

Menampilkan kendaraan yang baru ditambahkan agar mudah dipantau.

### Tujuan
Menampilkan kendaraan yang paling baru ditambahkan agar petugas mudah memantau data masuk terbaru.
### Selesai bila
- Daftar menampilkan kendaraan terbaru diurutkan dari yang paling akhir ditambahkan, dengan jumlah terbatas (mis. 5 teratas).
- Tiap baris menampilkan minimal nomor polisi, merk/tipe, dan tanggal penambahan.
- Kendaraan yang baru saja ditambahkan lewat menu Daftar Kendaraan langsung muncul di daftar ini.

## Task

### 1. Bangun halaman dashboard kendaraan dengan data tiruan

### 2. Tampilkan kartu total kendaraan dinas

### 3. Buat daftar kendaraan sedang dipakai

### 4. Buat ringkasan status kondisi berwarna

### 5. Buat daftar aset kendaraan terbaru

### 6. Lengkapi empty state dan responsivitas dashboard

### 7. Sediakan service agregasi data dashboard

### 8. Buat endpoint total dan status kondisi

### 9. Buat endpoint kendaraan sedang dipakai

### 10. Buat endpoint aset kendaraan terbaru
