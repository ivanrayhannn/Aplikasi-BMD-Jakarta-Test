// Pelengkap data uji kendaraan (diminta pemilik produk, UAT 19 Nov 2026): berkas sumber DKI tidak memuat
// nomor mesin, STNK, BPKB, masa berlaku, dan spesifikasi. Nilai di sini disusun agar wajar untuk tiap model,
// bukan data resmi. Tanggal dihitung relatif terhadap hari data dimuat supaya pengingat dashboard tetap bermakna.

/** nomor_polisi -> [kode mesin, isi silinder cc, bahan bakar, warna, bulan perolehan, lokasi] */
const SPEK = {
  'B 1426 PQA': ['M20A', 1987, 'bensin', 'Hitam', 3, 'Pool Dishub Jl. Taman Jati Baru'],
  'B 3871 PQD': ['KF41E', 125, 'bensin', 'Hitam', 2, 'Pool Dishub Jl. Taman Jati Baru'],
  'B 1709 PQB': ['4JJ1', 2999, 'solar', 'Putih', 6, 'RSUD Tarakan'],
  'B 1938 PQB': ['1GD', 2755, 'solar', 'Putih', 8, 'Kantor Dinkes Jl. Kesehatan'],
  'B 9512 PQC': ['4P10', 3908, 'solar', 'Kuning', 11, 'Depo DLH Sunter'],
  'B 9547 PQC': ['4JA1', 2499, 'solar', 'Putih', 5, 'Depo DLH Sunter'],
  'B 9620 PQE': ['W04D', 4009, 'solar', 'Kuning', 9, 'Bengkel rekanan DBM Pulogadung'],
  'B 9705 PQF': ['J08E', 7684, 'solar', 'Merah', 4, 'Pos Damkar Gambir'],
  'B 1854 PQG': ['2GD', 2393, 'solar', 'Hitam', 7, 'Markas Satpol PP Balai Kota'],
  'B 1213 PQH': ['EM16', null, 'listrik', 'Putih', 1, 'Gedung Bappeda Balai Kota'],
  'B 9381 PQJ': ['K15B', 1462, 'bensin', 'Hitam', 10, 'Gudang DSDA Pluit'],
  'B 3920 PQJ': ['KD07E', 149, 'bensin', 'Merah', 3, 'Gudang DSDA Pluit'],
  'B 1105 PQK': ['2GD', 2393, 'solar', 'Putih', 6, 'Kantor BPAD Jl. Abdul Muis'],
  'B 1627 PQL': ['4A91', 1499, 'bensin', 'Silver', 4, 'Gedung Diskominfotik Balai Kota'],
  'B 1482 PQM': ['1NR', 1329, 'bensin', 'Silver', 2, 'Kantor Disdik Jl. Gatot Subroto'],
  'B 9264 PQN': ['K3-DE', 1329, 'bensin', 'Putih', 12, 'Kantor Dinsos Jl. Gunung Sahari'],
  'B 1390 PQP': ['4N15', 2442, 'solar', 'Hitam', 5, 'Pusdalops BPBD Jl. Kyai Tapa'],
  'B 1576 PQR': ['EV17', null, 'listrik', 'Putih', 9, 'Kantor Dukcapil Jl. Letjen Suprapto'],
  'B 9433 PQS': ['4G63', 2268, 'solar', 'Biru', 8, 'Pembibitan Distamhut Cilandak'],
  'B 3716 PQT': ['G3L', 155, 'bensin', 'Abu-abu', 7, 'GOR Dispora Jl. Pemuda'],
};

const pad = (n, len) => String(n).padStart(len, '0');

/** Angka semu yang stabil per kendaraan agar data tidak berubah setiap kali dimuat. */
function seedNum(text, mod) {
  let h = 7;
  for (const c of text) h = (h * 31 + c.charCodeAt(0)) % 2_147_483_647;
  return h % mod;
}

function addDays(base, days) {
  const d = new Date(`${base}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Melengkapi kolom kendaraan uji. `i` adalah urutan di berkas sumber.
 * Dua kendaraan sengaja dekat jatuh tempo (pajak dan STNK) agar pengingat dashboard bisa diuji.
 */
export function lengkapiKendaraan(k, i, hariIni) {
  const [mesin, cc, bbm, warna, bulan, lokasi] = SPEK[k.nomor_polisi] ?? ['ENG', null, 'bensin', 'Hitam', 1, null];
  const pajakOffset = i === 4 ? 12 : 45 + seedNum(k.nomor_polisi + 'pajak', 300);
  const stnkOffset = i === 6 ? 25 : 200 + seedNum(k.nomor_polisi + 'stnk', 1300);
  return {
    nomor_mesin: `${mesin}-${pad(seedNum(k.nomor_rangka, 1_000_000), 6)}`,
    nomor_stnk: pad(seedNum(k.nomor_polisi + 'stnk-no', 100_000_000), 8),
    nomor_bpkb: `${String.fromCharCode(76 + (k.tahun_produksi % 14))}-${pad(seedNum(k.nomor_rangka + 'bpkb', 10_000_000), 7)}`,
    isi_silinder_cc: cc,
    bahan_bakar: bbm,
    warna,
    tanggal_perolehan: `${k.tahun_produksi}-${pad(bulan, 2)}-${pad(5 + seedNum(k.nomor_polisi, 20), 2)}`,
    tanggal_pajak: addDays(hariIni, pajakOffset),
    masa_berlaku_stnk: addDays(hariIni, stnkOffset),
    lokasi,
  };
}

export { addDays };
