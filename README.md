# SI-KDO — Sistem Informasi Kendaraan Dinas Operasional

Aplikasi web untuk mengelola data **Kendaraan Dinas Operasional (KDO)** milik Perangkat Daerah sebagai bagian
dari pengelolaan **Barang Milik Daerah (BMD)**. Aplikasi ini membantu:

- pendataan KDO (identitas barang dan kendaraan),
- pemantauan **kondisi** kendaraan melalui pemeriksaan berkala (Baik / Rusak Ringan / Rusak Berat),
- pencatatan **pegawai penanggung jawab** penggunaan kendaraan beserta riwayat dan nomor BAST,
- rekapitulasi dan pelaporan per Perangkat Daerah.

## Teknologi

| Lapisan  | Teknologi |
|----------|-----------|
| Frontend | Vue 3 (ES module, tanpa build step) — disajikan dari `node_modules`, tidak bergantung pada CDN |
| Backend  | Node.js ≥ 22.5 + Express 5 (REST API JSON) |
| Database | SQLite (modul bawaan `node:sqlite`) — file `data/kdo.db` |

## Menjalankan

```bash
npm install
```

```bash
npm start
```

Buka http://localhost:3000. Variabel lingkungan opsional: `PORT` (default 3000), `DB_FILE` (default `data/kdo.db`).
Database dan data contoh dibuat otomatis saat pertama dijalankan.

| Akun     | Kata sandi | Peran |
|----------|------------|-------|
| admin    | admin123   | Administrator BPAD — seluruh Perangkat Daerah |
| dishub   | dishub123  | Pengurus Barang Dinas Perhubungan |
| dinkes   | dinkes123  | Pengurus Barang Dinas Kesehatan |

> Ganti kata sandi akun demo sebelum digunakan di lingkungan produksi.

## Pengujian

```bash
npm test
```

## Struktur

```
src/        server.js (entry), app.js (route + business rules), db.js (skema + seed), auth.js
public/     index.html, app.js (Vue SPA), styles.css
test/       api.test.js — pengujian API & business rules
docs/       kebutuhan.md — ruang lingkup, proses bisnis, business rules, skenario uji
```

Dokumen kebutuhan dan aturan bisnis lengkap: [docs/kebutuhan.md](docs/kebutuhan.md).
