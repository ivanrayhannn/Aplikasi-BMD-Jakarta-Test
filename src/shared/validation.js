// Validasi input: satu tempat untuk API dan form (PRD §5 "Validasi berlapis").
// Setiap skema adalah peta field → aturan. `validate()` mengembalikan data yang sudah
// dinormalisasi beserta pesan error per field, sehingga pesan di form dan di respons API selalu sama.
import {
  KONDISI, JENIS_KENDARAAN, BAHAN_BAKAR, GOLONGAN, JENIS_KELAMIN,
  STATUS_KEPEGAWAIAN, JENIS_PERAWATAN, PERAN, values,
} from './enums.js';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const NOPOL_RE = /^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;
const MAX_DECIMAL = 9_999_999_999_999.99; // DECIMAL(15,2)

/** Tanggal hari ini (zona waktu lokal) dalam format YYYY-MM-DD. */
export function today() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const isBlank = (v) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

// Pembangun aturan
// Setiap aturan: { label, required, parse(value) -> nilai | throw pesan }.
const rule = (label, parse, { required = false, fallback = null } = {}) => ({ label, required, parse, fallback });

const text = (label, { required, max, pattern, patternMessage, transform } = {}) =>
  rule(label, (v) => {
    let s = String(v).trim();
    if (transform) s = transform(s);
    if (max && s.length > max) throw `${label} maksimal ${max} karakter`;
    if (pattern && !pattern.test(s)) throw patternMessage ?? `Format ${label} tidak valid`;
    return s;
  }, { required });

const integer = (label, { required, min, max } = {}) =>
  rule(label, (v) => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw `${label} harus berupa bilangan bulat`;
    if (min !== undefined && n < min) throw `${label} minimal ${min}`;
    if (max !== undefined && n > max) throw `${label} maksimal ${max}`;
    return n;
  }, { required });

const decimal = (label, { required } = {}) =>
  rule(label, (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw `${label} harus berupa angka ≥ 0`;
    if (n > MAX_DECIMAL) throw `${label} terlalu besar`;
    return Math.round(n * 100) / 100;
  }, { required });

const date = (label, { required, notFuture } = {}) =>
  rule(label, (v) => {
    const s = String(v);
    if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw `${label} harus berformat tanggal (YYYY-MM-DD)`;
    if (notFuture && s > today()) throw `${label} tidak boleh melebihi hari ini`;
    return s;
  }, { required });

const oneOf = (label, opts, { required, fallback } = {}) =>
  rule(label, (v) => {
    if (!values(opts).includes(v)) throw `${label} tidak valid. Pilihan: ${opts.map((o) => o.label).join(', ')}`;
    return v;
  }, { required, fallback });

const id = (label, { required } = {}) =>
  rule(label, (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw `${label} tidak valid`;
    return n;
  }, { required });

const bool = (label, fallback = 1) =>
  rule(label, (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0), { fallback });

const email = (label, opts) => text(label, { max: 100, pattern: EMAIL_RE, patternMessage: `Format ${label} tidak valid`, transform: (s) => s.toLowerCase(), ...opts });
const phone = (label) => text(label, { max: 20, pattern: PHONE_RE, patternMessage: `${label} hanya boleh berisi angka, spasi, tanda - atau + (6–20 karakter)` });

// Skema per entitas
export const schemas = {
  perangkatDaerah: {
    kode: text('Kode', { required: true, max: 20, transform: (s) => s.toUpperCase() }),
    nama_dinas: text('Nama dinas', { required: true, max: 150 }),
    singkatan: text('Singkatan', { max: 30, transform: (s) => s.toUpperCase() }),
    alamat: text('Alamat', { max: 500 }),
    no_telepon: phone('Nomor telepon'),
    email: email('Email'),
    is_aktif: bool('Status aktif'),
  },

  pns: {
    nip: text('NIP', { required: true, pattern: /^\d{18}$/, patternMessage: 'NIP harus 18 digit angka', transform: (s) => s.replace(/\s/g, '') }),
    nama_pegawai: text('Nama pegawai', { required: true, max: 150 }),
    jabatan: text('Jabatan', { required: true, max: 150 }),
    golongan: oneOf('Golongan', GOLONGAN),
    pangkat: text('Pangkat', { max: 50 }),
    perangkat_daerah_id: id('Perangkat daerah', { required: true }),
    jenis_kelamin: oneOf('Jenis kelamin', JENIS_KELAMIN),
    no_hp: phone('Nomor HP'),
    email: email('Email'),
    status_kepegawaian: oneOf('Status kepegawaian', STATUS_KEPEGAWAIAN, { fallback: 'aktif' }),
  },

  kdo: {
    nomor_polisi: text('Nomor polisi', {
      required: true, max: 15, pattern: NOPOL_RE,
      patternMessage: 'Format nomor polisi tidak valid (contoh: B 1234 ABC)',
      transform: (s) => s.toUpperCase().replace(/\s+/g, ' '),
    }),
    merek: text('Merek', { required: true, max: 50 }),
    tipe: text('Tipe', { max: 80 }),
    tahun_produksi: integer('Tahun produksi', { required: true, min: 1980, max: 2100 }),
    warna: text('Warna', { max: 30 }),
    kondisi: oneOf('Kondisi', KONDISI, { fallback: 'baik' }),
    jenis_kendaraan: oneOf('Jenis kendaraan', JENIS_KENDARAAN, { required: true }),
    nomor_rangka: text('Nomor rangka', { required: true, max: 30, transform: (s) => s.toUpperCase() }),
    nomor_mesin: text('Nomor mesin', { max: 30, transform: (s) => s.toUpperCase() }),
    isi_silinder_cc: integer('Isi silinder', { min: 0, max: 100_000 }),
    bahan_bakar: oneOf('Bahan bakar', BAHAN_BAKAR),
    nomor_bpkb: text('Nomor BPKB', { max: 30, transform: (s) => s.toUpperCase() }),
    masa_berlaku_stnk: date('Masa berlaku STNK'),
    tanggal_pajak: date('Tanggal pajak'),
    tanggal_perolehan: date('Tanggal perolehan', { notFuture: true }),
    nilai_perolehan: decimal('Nilai perolehan'),
    kode_barang_aset: text('Kode barang aset', { max: 30 }),
    perangkat_daerah_id: id('Perangkat daerah', { required: true }),
    pemegang_pns_id: id('Pemegang'),
    keterangan: text('Keterangan', { max: 2000 }),
    is_aktif: bool('Status aktif'),
  },

  pemakaian: {
    kdo_id: id('Kendaraan', { required: true }),
    pns_id: id('Pegawai', { required: true }),
    tanggal_mulai: date('Tanggal mulai', { required: true, notFuture: true }),
    keterangan: text('Keperluan / keterangan', { max: 500 }),
  },

  pemakaianSelesai: {
    tanggal_selesai: date('Tanggal selesai', { required: true, notFuture: true }),
    keterangan: text('Keterangan', { max: 500 }),
  },

  perawatan: {
    kdo_id: id('Kendaraan', { required: true }),
    tanggal_servis: date('Tanggal servis', { required: true, notFuture: true }),
    jenis_perawatan: oneOf('Jenis perawatan', JENIS_PERAWATAN, { required: true }),
    deskripsi: text('Deskripsi', { max: 2000 }),
    bengkel: text('Bengkel', { max: 150 }),
    biaya: decimal('Biaya', { required: true }),
    kondisi_setelah: oneOf('Kondisi setelah servis', KONDISI, { required: true }),
    jadwal_berikutnya: date('Jadwal servis berikutnya'),
  },

  login: {
    email: email('Email', { required: true }),
    password: rule('Kata sandi', (v) => String(v), { required: true }),
  },

  pengguna: {
    nama: text('Nama', { required: true, max: 150 }),
    email: email('Email', { required: true }),
    role: oneOf('Peran', PERAN, { required: true }),
    pns_id: id('Pegawai terkait'),
    is_active: bool('Status aktif'),
    password: text('Kata sandi', { pattern: /^.{8,72}$/, patternMessage: 'Kata sandi minimal 8 karakter' }),
  },

  pengaturan: {
    nama_instansi: text('Nama instansi', { required: true, max: 200 }),
    alamat: text('Alamat instansi', { max: 500 }),
    logo_url: rule('Logo', (v) => {
      const s = String(v);
      if (!/^data:image\/(png|jpeg|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(s)) throw 'Logo harus berupa gambar PNG, JPG, atau SVG';
      if (s.length > 400_000) throw 'Ukuran logo maksimal ±300 KB';
      return s;
    }),
    pengingat_servis_hari: integer('Pengingat servis (hari)', { required: true, min: 1, max: 365 }),
    pengingat_pembaruan_hari: integer('Pengingat pembaruan data (hari)', { required: true, min: 1, max: 3650 }),
  },
};

/**
 * Memvalidasi dan menormalisasi input sesuai skema.
 * Field kosong yang tidak wajib menjadi `null`, kecuali aturan punya nilai bawaan (mis. status aktif = 1).
 * @param {Record<string, any>} schema
 * @param {Record<string, any>} input
 * @param {{ only?: string[] }} [options] hanya memvalidasi field tertentu
 * @returns {{ data: Record<string, any>, errors: Record<string, string> | null }}
 */
export function validate(schema, input = {}, { only } = {}) {
  const data = {};
  const errors = {};
  for (const [field, r] of Object.entries(schema)) {
    if (only && !only.includes(field)) continue;
    const raw = input?.[field];
    if (isBlank(raw)) {
      if (r.required) errors[field] = `${r.label} wajib diisi`;
      else data[field] = r.fallback;
      continue;
    }
    try {
      data[field] = r.parse(raw);
    } catch (message) {
      errors[field] = typeof message === 'string' ? message : `${r.label} tidak valid`;
    }
  }
  return { data, errors: Object.keys(errors).length ? errors : null };
}

/** Label manusiawi untuk sebuah field (dipakai pesan error unik dari database). */
export function fieldLabel(schema, field) {
  return schema[field]?.label ?? field;
}
