# DESIGN.md: arah desain SI-KDO

Arah ini diturunkan dari PRD (aplikasi internal instansi, staf non-teknis, laporan resmi yang dicetak dan ditandatangani). Pemilik produk belum memberikan panduan merek; bila ada, panduan itu menggantikan bagian palet dan tipografi di bawah.

## Design Read

Reading this as: aplikasi administrasi aset internal untuk staf Perangkat Daerah yang non-teknis, dengan bahasa visual layanan publik yang tenang dan dokumen dinas, dial **ENERGY 1 / RHYTHM 1 / MOTION 1**.

| Dial | Nilai | Alasan |
|---|---|---|
| ENERGY | 1 (tenang) | Dipakai berjam-jam untuk mengisi data dan membaca tabel; tampilan tidak boleh bersaing dengan data. |
| RHYTHM | 1 (seragam) | Pola halaman yang sama (judul, filter berlabel, tabel, aksi) membuat staf cepat hafal; keseragaman ini disengaja. |
| MOTION | 1 (hanya hover/fokus) | Tidak ada animasi dekoratif; satu-satunya transisi (redup saat laporan dimuat) mati bila `prefers-reduced-motion`. |

## Keputusan dan alasannya

| Keputusan | Alasan (satu baris) |
|---|---|
| Biru tua `#0b4f8a` sebagai warna utama | Warna dinas yang netral dan kontras tinggi (8.4:1 di putih) untuk tautan dan tombol utama. |
| Sidebar navy `#0f2a44` | Memisahkan navigasi dari area kerja tanpa garis tambahan, dan memberi kesan kantor pemerintahan. |
| Satu aksen oranye `#e8792b` | Hanya di nama produk dan penanda menu aktif, agar posisi pengguna selalu jelas tanpa warna berlebih. |
| Hijau, kuning, merah untuk kondisi | Mengikuti spesifikasi fitur 01 (baik, perlu servis, rusak), selalu disertai teks label. |
| Latar abu sangat muda + kartu putih | Kartu memisahkan kelompok data; latar tidak putih penuh agar kartu terbaca tanpa bayangan. |
| Font sistem (`system-ui`) | Berjalan di jaringan intranet tanpa unduhan font, tampil sebagai font yang sudah familier di PC kantor. |
| Ukuran dasar 14 px, label kalimat biasa | Padat untuk tabel; label tanpa huruf kapital semua agar mudah dibaca staf non-teknis. |
| Radius 8 px kartu, 6 px kontrol, pil hanya untuk badge status | Badge pil menandai status; kontrol dan kartu tetap persegi agar tidak tertukar dengan badge. |
| Bayangan hanya pada modal dan toast | Hanya lapisan yang benar-benar di atas halaman yang terangkat. |
| Tema terang saja, tanpa mode gelap | Aplikasi kantor siang hari yang hasil utamanya dokumen cetak; tampilan layar sama dengan kertas. |
| Kartu total aset terisi warna utama | Titik fokus dashboard: angka pertama yang dicari petugas ("first win" PRD). |
| Tabel menjadi kartu berlabel di ponsel | Kolom penting (kondisi, pemegang) tidak terdorong keluar layar. |
| Menu "Menu" berlabel di ponsel | Navigasi 12 tautan tidak muat sebagai baris; tombol berteks lebih jelas dari ikon hamburger. |
| Tanpa ikon | Label teks Indonesia sudah jelas; ikon generik tidak menambah informasi. |

## Motif identitas

Kop laporan bergaris ganda (`border-bottom: 3px double`) meniru kop surat dinas. Motif yang sama dipakai di pratinjau kop pada Pengaturan, sehingga laporan di layar, PDF, dan cetak terasa sebagai dokumen resmi instansi.

## Aset

Tidak ada logo yang dibuat. Nama produk ditulis sebagai teks "SI-KDO". Logo instansi diunggah sendiri oleh admin di menu Pengaturan.

## Aksesibilitas

| Pasangan | Rasio | Syarat |
|---|---|---|
| Teks `#1c2430` / putih | 15.62:1 | 4.5:1 |
| Teks redup `#5d6878` / putih | 5.65:1 | 4.5:1 |
| Teks redup / badge abu `#eceff3` | 4.90:1 | 4.5:1 |
| Hijau `#17704a` / `#e5f4ec` | 5.35:1 | 4.5:1 |
| Kuning `#9a6200` / `#fdf1dc` | 4.56:1 | 4.5:1 |
| Merah `#b3261e` / `#fbe7e5` | 5.50:1 | 4.5:1 |
| Teks sidebar `#c9d6e4` / `#0f2a44` | 9.91:1 | 4.5:1 |
| Label grup menu `#a4b4c4` / `#0f2a44` | 6.90:1 | 4.5:1 |
| Batas input/tombol `#8a94a3` / putih | 3.07:1 | 3:1 (non-teks) |
| Outline fokus `#0b4f8a` / putih | 8.40:1 | 3:1 (non-teks) |

Rasio dihitung dengan rumus WCAG 2.x, bukan perkiraan visual.
