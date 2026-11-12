// Pilihan terkendali (ENUM): PRD §6 & fitur 07 "Pilihan Terkendali".
// Satu-satunya sumber nilai ENUM: dipakai skema DB (CHECK constraint), validasi API,
// dan dropdown form. Menambah pilihan = mengubah file ini + migrasi, bukan tabel kategori.

/** @typedef {{ value: string, label: string }} Option */

const options = (pairs) => Object.freeze(pairs.map(([value, label]) => Object.freeze({ value, label })));

export const KONDISI = options([
  ['baik', 'Baik'],
  ['rusak_ringan', 'Rusak Ringan'],
  ['rusak_berat', 'Rusak Berat'],
]);

export const JENIS_KENDARAAN = options([
  ['roda_2', 'Roda 2'],
  ['roda_4', 'Roda 4'],
  ['roda_6', 'Roda 6'],
  ['bus', 'Bus'],
  ['truk', 'Truk'],
  ['lainnya', 'Lainnya'],
]);

export const BAHAN_BAKAR = options([
  ['bensin', 'Bensin'],
  ['solar', 'Solar'],
  ['listrik', 'Listrik'],
  ['hybrid', 'Hybrid'],
  ['lainnya', 'Lainnya'],
]);

export const GOLONGAN = options(
  [
    ...['a', 'b', 'c', 'd'].map((s) => `I/${s}`),
    ...['a', 'b', 'c', 'd'].map((s) => `II/${s}`),
    ...['a', 'b', 'c', 'd'].map((s) => `III/${s}`),
    ...['a', 'b', 'c', 'd', 'e'].map((s) => `IV/${s}`),
  ].map((g) => [g, g])
);

export const JENIS_KELAMIN = options([
  ['L', 'Laki-laki'],
  ['P', 'Perempuan'],
]);

export const STATUS_KEPEGAWAIAN = options([
  ['aktif', 'Aktif'],
  ['pensiun', 'Pensiun'],
  ['mutasi', 'Mutasi'],
  ['nonaktif', 'Nonaktif'],
]);

export const JENIS_PERAWATAN = options([
  ['rutin', 'Servis Rutin'],
  ['perbaikan', 'Perbaikan'],
  ['ganti_oli', 'Ganti Oli'],
  ['pajak', 'Pajak / Administrasi'],
  ['lainnya', 'Lainnya'],
]);

export const STATUS_PEMAKAIAN = options([
  ['aktif', 'Aktif'],
  ['selesai', 'Selesai'],
]);

export const PERAN = options([
  ['admin', 'Pengelola Aset (Admin)'],
  ['petugas', 'Petugas Lapangan'],
]);

/** Kelompok yang ditampilkan di halaman Pengaturan → Pilihan Terkendali. */
export const ENUMS = Object.freeze({
  jenis_kendaraan: JENIS_KENDARAAN,
  kondisi: KONDISI,
  bahan_bakar: BAHAN_BAKAR,
  golongan: GOLONGAN,
  jenis_kelamin: JENIS_KELAMIN,
  status_kepegawaian: STATUS_KEPEGAWAIAN,
  jenis_perawatan: JENIS_PERAWATAN,
  status_pemakaian: STATUS_PEMAKAIAN,
  peran: PERAN,
});

export const values = (opts) => opts.map((o) => o.value);

/** Label tampilan untuk sebuah nilai ENUM; mengembalikan nilai aslinya bila tidak dikenal. */
export function labelOf(opts, value) {
  return opts.find((o) => o.value === value)?.label ?? value ?? '';
}
