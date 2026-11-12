// Membangkitkan src/api/seed-data.js dari docs/data/data_aset_kendaraan_dki.md (tabel Markdown pemilik produk).
// Jalankan: node scripts/generate-seed-data.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { PERUNTUKAN } from '../src/shared/enums.js';

const SOURCE = 'docs/data/data_aset_kendaraan_dki.md';
const md = readFileSync(SOURCE, 'utf8');

/** Baris data tabel Markdown di antara dua judul bagian (tanpa baris judul kolom dan pemisah). */
function rows(from, to) {
  const part = md.split(from)[1].split(to)[0];
  return part.split('\n').filter((l) => l.startsWith('|')).slice(2)
    .map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
}


// Jenis di sumber menggabungkan jenis dan peruntukan ("Roda 4 – Operasional"); keduanya dipisah ke dua kolom ENUM.
const JENIS = { 'Roda 4': 'roda_4', 'Roda 2': 'roda_2', 'Truk Sampah': 'truk', 'Truk Dump': 'truk', 'Mobil Pemadam': 'mobil_pemadam', Ambulans: 'ambulans' };
const peruntukanOf = (label) => {
  const found = PERUNTUKAN.find((o) => o.label === label);
  if (!found) throw new Error(`Peruntukan tidak dikenal: ${label}`);
  return found.value;
};
const KONDISI = { Baik: 'baik', 'Rusak Ringan': 'rusak_ringan', 'Rusak Berat': 'rusak_berat' };

const skpd = rows('## 1. Master SKPD', '## 2.').map(([kode, nama_dinas, singkatan]) => ({ kode, nama_dinas, singkatan }));
const pegawai = rows('## 2. Master Pegawai', '## 3.').map(([nip, nama_pegawai, jenis_kelamin, golongan, jabatan, skpd]) =>
  ({ nip, nama_pegawai, jenis_kelamin, golongan, jabatan, skpd }));
const kendaraan = rows('## 3. Aset Kendaraan Dinas', '## Ringkasan').map(
  ([kode_barang_aset, nomor_polisi, merekTipe, jenis, tahun, nomor_rangka, skpd, pemegang_nip, kondisi, nilai]) => {
    const [base, peruntukan] = jenis.split(/\s+[–-]\s+/);
    if (!JENIS[base]) throw new Error(`Jenis tidak dikenal: ${jenis}`);
    const spasi = merekTipe.indexOf(' ');
    return {
      kode_barang_aset, nomor_polisi, merek: merekTipe.slice(0, spasi), tipe: merekTipe.slice(spasi + 1),
      jenis_kendaraan: JENIS[base], peruntukan: peruntukan ? peruntukanOf(peruntukan) : null,
      tahun_produksi: Number(tahun), nomor_rangka, skpd, pemegang_nip,
      kondisi: KONDISI[kondisi], nilai_perolehan: Number(nilai.replace(/\./g, '')),
      // Truk sampah/dump hanya punya jenis "truk" di ENUM; nama aslinya disimpan agar tidak hilang.
      keterangan: base.startsWith('Truk') ? base : null,
    };
  });

const singkatan = new Set(skpd.map((s) => s.singkatan));
const nips = new Set(pegawai.map((p) => p.nip));
for (const p of pegawai) if (!singkatan.has(p.skpd)) throw new Error(`SKPD pegawai tidak ada: ${p.skpd}`);
for (const k of kendaraan) {
  if (!singkatan.has(k.skpd)) throw new Error(`SKPD kendaraan tidak ada: ${k.skpd}`);
  if (!nips.has(k.pemegang_nip)) throw new Error(`NIP pemegang tidak ada: ${k.pemegang_nip}`);
}

const json = (v) => JSON.stringify(v, null, 2);
writeFileSync('src/api/seed-data.js', `// Data awal dari berkas pemilik produk "Data Uji: Aset Kendaraan Dinas Pemprov DKI Jakarta"
// (${SOURCE}). Dibangkitkan oleh scripts/generate-seed-data.mjs; ubah berkas sumbernya lalu bangkitkan ulang,
// jangan mengetik ulang di sini. Penyesuaian ke skema: lihat docs/PRD.md bagian 10.

/** ${skpd.length} perangkat daerah (SKPD). Nomenklatur perlu dicek ulang sebelum produksi. */
export const SKPD = ${json(skpd)};

/** ${pegawai.length} pegawai; \`skpd\` merujuk singkatan SKPD. */
export const PEGAWAI = ${json(pegawai)};

/**
 * ${kendaraan.length} kendaraan dinas. Jenis dan peruntukan dari kolom "Jenis" sumber dipisah ke dua ENUM.
 * \`pemegang_nip\` menjadi pemakaian aktif sejak data dimuat.
 */
export const KENDARAAN = ${json(kendaraan)};
`);
console.log(`seed-data.js: ${skpd.length} SKPD, ${pegawai.length} pegawai, ${kendaraan.length} kendaraan.`);
