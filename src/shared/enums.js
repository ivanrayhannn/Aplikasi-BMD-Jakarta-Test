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
  ['ambulans', 'Ambulans'],
  ['mobil_pemadam', 'Mobil Pemadam'],
  ['lainnya', 'Lainnya'],
]);

/** Peruntukan kendaraan (Q-8): untuk apa kendaraan dipakai, terpisah dari jenisnya. */
export const PERUNTUKAN = options([
  ['jabatan', 'Jabatan'],
  ['operasional', 'Operasional'],
  ['patroli', 'Patroli'],
  ['kedaruratan', 'Kedaruratan'],
  ['lapangan', 'Lapangan'],
  ['layanan_keliling', 'Layanan Keliling'],
  ['angkut_pegawai', 'Angkut Pegawai'],
  ['angkut_barang', 'Angkut Barang'],
  ['angkut_logistik', 'Angkut Logistik'],
  ['angkut_tanaman', 'Angkut Tanaman'],
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
  ['approver', 'Approver'],
  ['petugas', 'Petugas Lapangan'],
  ['pegawai', 'Pegawai'],
]);

/** Status siklus hidup aset, terpisah dari kondisi fisik (KONDISI). */
export const STATUS_ASET = options([
  ['aktif', 'Aktif (dipakai)'],
  ['siaga', 'Siaga (standby)'],
  ['perawatan', 'Dalam Perawatan'],
  ['rusak', 'Rusak'],
  ['dihapuskan', 'Dihapuskan'],
]);

/** Jenis pengajuan siklus aset. Pengembalian tidak butuh approval; jenis lain wajib disetujui Approver. */
export const JENIS_PENGAJUAN = options([
  ['pengadaan', 'Pengadaan'],
  ['penugasan', 'Penugasan Pemegang'],
  ['pengembalian', 'Pengembalian Aset'],
  ['mutasi', 'Mutasi'],
  ['disposal', 'Disposal'],
]);

export const STATUS_PENGAJUAN = options([
  ['diajukan', 'Menunggu Persetujuan'],
  ['disetujui', 'Disetujui'],
  ['dipesan', 'PR/PO Terbit'],
  ['diterima', 'Unit Diterima'],
  ['selesai', 'Selesai'],
  ['ditolak', 'Ditolak'],
  ['dibatalkan', 'Dibatalkan'],
]);

export const METODE_DISPOSAL = options([
  ['penjualan', 'Penjualan'],
  ['lelang', 'Lelang'],
  ['scrap', 'Scrap / Dimusnahkan'],
]);

export const JENIS_BERITA_ACARA = options([
  ['serah_terima', 'Serah Terima'],
  ['pengembalian', 'Pengembalian'],
  ['mutasi', 'Mutasi'],
  ['penghapusan', 'Penghapusan'],
  ['penerimaan', 'Penerimaan Barang'],
]);

/** Kelengkapan yang diperiksa saat pengembalian dan penerimaan unit. */
export const KELENGKAPAN = options([
  ['stnk', 'STNK'],
  ['kunci', 'Kunci utama'],
  ['kunci_cadangan', 'Kunci cadangan'],
  ['buku_servis', 'Buku servis'],
  ['ban_serep', 'Ban serep'],
  ['dongkrak', 'Dongkrak & toolkit'],
]);

/** Kelompok yang ditampilkan di halaman Pengaturan → Pilihan Terkendali. */
export const ENUMS = Object.freeze({
  jenis_kendaraan: JENIS_KENDARAAN,
  peruntukan: PERUNTUKAN,
  kondisi: KONDISI,
  bahan_bakar: BAHAN_BAKAR,
  golongan: GOLONGAN,
  jenis_kelamin: JENIS_KELAMIN,
  status_kepegawaian: STATUS_KEPEGAWAIAN,
  jenis_perawatan: JENIS_PERAWATAN,
  status_pemakaian: STATUS_PEMAKAIAN,
  peran: PERAN,
  status_aset: STATUS_ASET,
  jenis_pengajuan: JENIS_PENGAJUAN,
  status_pengajuan: STATUS_PENGAJUAN,
  metode_disposal: METODE_DISPOSAL,
  jenis_berita_acara: JENIS_BERITA_ACARA,
  kelengkapan: KELENGKAPAN,
});

export const values = (opts) => opts.map((o) => o.value);

/** Label tampilan untuk sebuah nilai ENUM; mengembalikan nilai aslinya bila tidak dikenal. */
export function labelOf(opts, value) {
  return opts.find((o) => o.value === value)?.label ?? value ?? '';
}
