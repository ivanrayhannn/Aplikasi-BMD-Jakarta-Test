# AGENTS.md: aturan kerja di repo SI-KDO

Panduan untuk developer dan agent AI yang mengubah kode di repo ini.

## Peta repo

| Folder | Isi | Boleh bergantung pada Node.js? |
|---|---|---|
| `src/shared/` | ENUM (`enums.js`) dan validasi (`validation.js`), dipakai server, browser, dan mode demo | Tidak |
| `src/api/` | REST API: `index.js` (router, autentikasi, otorisasi, error), `modules/*.js` per domain, `schema.js` (DDL SQLite + seed), `http.js`, `db.js` | Tidak |
| `src/server/` | Express, `node:sqlite`, scrypt | Ya |
| `public/` | Frontend Vue 3 tanpa build step: `js/pages`, `js/components`, `styles.css` | Tidak (browser) |
| `demo/backend.js` | Menjalankan `src/api` di browser dengan sql.js untuk GitHub Pages | Tidak (browser) |
| `db/mysql/` | DDL MySQL 8.4 setara `src/api/schema.js` | |
| `docs/` | PRD, API, setup, Postman, workbook screenshot | |
| `test/` | `*.test.js` (node:test) dan `e2e/click-through.cjs` (Playwright) | |

`src/api` dan `src/shared` dijalankan juga di browser. Jangan impor modul Node (`fs`, `crypto`, `express`) di sana; kebutuhan seperti hash sandi diteruskan lewat parameter `security`.

## Konvensi

- **Bahasa:** nama tabel, kolom, endpoint, dan teks UI memakai Bahasa Indonesia sesuai PRD (`perangkat_daerah`, `nomor_polisi`). Kode lain (fungsi, variabel) boleh Inggris atau Indonesia, konsisten dalam satu berkas.
- **Penamaan:** kolom dan field JSON `snake_case`; fungsi dan variabel JS `camelCase`; komponen Vue `PascalCase`; berkas `kebab-case.js`.
- **Endpoint:** `/api/v1/<entitas-jamak-kebab>`; `GET` daftar, `GET /{id}`, `POST`, `PUT /{id}` (semantik gabung), `DELETE /{id}`. Aksi khusus memakai sub-path kata kerja (`POST /pemakaian/{id}/selesai`).
- **Respons:** selalu lewat `send(res, data, { meta, status })`. Error selalu dengan melempar `ApiError` (`invalid`, `conflict`, `notFound`, `forbidden`); jangan menulis `res.status(4xx)` langsung di modul.
- **Validasi:** tambahkan aturan di `src/shared/validation.js`, bukan di modul atau komponen. Form memakai `useForm(schemas.x)` agar pesan klien sama dengan server.
- **ENUM:** satu sumber di `src/shared/enums.js`. Menambah pilihan berarti mengubah file ini, CHECK di `schema.js`, dan ENUM di DDL MySQL.
- **Unik:** cek dengan `assertUnique` agar `422` menyebut field; constraint UNIQUE di DB tetap wajib.
- **Relasi:** aturan hapus dan pemegang ditulis eksplisit di modul (lihat BR-05 s.d. BR-18 di `docs/PRD.md`). Pemegang kendaraan hanya diubah lewat `openPemakaian` / tutup pemakaian.
- **Transaksi:** perubahan yang menyentuh lebih dari satu tabel dibungkus `transaction(db, fn)`.
- **Audit:** setiap aksi tulis memanggil `log(req, AKSI, entitas, id, detail)`.
- **Komentar:** jelaskan alasan atau aturan bisnis, bukan isi baris kode. Tanpa banner dekoratif dan tanpa narasi langkah.

## Migrasi skema

- Skema dibuat oleh `initDatabase` dan diberi versi lewat `PRAGMA user_version` (`SCHEMA_VERSION`).
- Setelah ada data produksi, **jangan mengubah DDL yang sudah dirilis**. Naikkan `SCHEMA_VERSION` dan tambahkan langkah migrasi bertahap (`ALTER TABLE`) dari versi sebelumnya. Cabang yang membuat ulang tabel hanya untuk database sebelum PRD.
- Setiap perubahan skema juga diterapkan di `db/mysql/kdo_master_tables.sql`.

## UI

- Ikuti `DESIGN.md` (dial ENERGY 1 / RHYTHM 1 / MOTION 1) dan aturan antislop: tanpa em dash, setiap field dan filter punya label terlihat, setiap data punya state memuat, kosong, dan error, kontras WCAG AA dihitung (bukan ditebak), target sentuh 44 px di ponsel.
- Tabel daftar memakai `class="stack"` dan `data-label` pada setiap `td` agar menjadi kartu di ponsel.
- Halaman khusus admin didaftarkan dengan `{ admin: true }` di `public/js/main.js`; tombol tulis dibungkus `v-if="isAdmin"`.

## Wajib saat menambah atau mengubah endpoint

1. Tambahkan uji di `test/*.test.js` untuk jalur sukses dan setiap kode error barunya.
2. Perbarui `docs/API.md`.
3. Tambahkan permintaan di `scripts/generate-postman.mjs`, jalankan `node scripts/generate-postman.mjs`, lalu Newman.
4. Bila menyentuh UI, tambahkan langkah di `test/e2e/click-through.cjs` dan perbarui workbook screenshot (`node scripts/build-screenshots.cjs`).
5. Bila mengubah kebutuhan atau aturan, perbarui status dan matriks di `docs/PRD.md`.

## Perintah

```bash
npm test
```

```bash
npm run test:e2e
```

```bash
npm run build:pages
```
