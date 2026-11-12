// Format tampilan (Rupiah, tanggal, label ENUM), dipakai layar, cetak, PDF, dan Excel agar konsisten.
import { ENUMS, labelOf } from '../lib/shared/enums.js';
import { today } from '../lib/shared/validation.js';

export { ENUMS, today };

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** 'Rp1.250.000' */
export function rupiah(n) {
  if (n === null || n === undefined || n === '') return '-';
  return 'Rp' + Math.round(Number(n)).toLocaleString('id-ID');
}

/** '12 Feb 2025' dari 'YYYY-MM-DD' (atau datetime UTC dari database). */
export function tanggal(value) {
  if (!value) return '-';
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return String(value);
  return `${String(d).padStart(2, '0')} ${BULAN[m - 1]} ${y}`;
}

/** Datetime UTC dari SQLite ('YYYY-MM-DD HH:MM:SS') → waktu lokal. */
export function waktu(value) {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const angka = (n) => (n === null || n === undefined ? '-' : Number(n).toLocaleString('id-ID'));

/** Label ENUM: label('kondisi', 'rusak_ringan') → 'Rusak Ringan'. */
export const label = (group, value) => (value ? labelOf(ENUMS[group], value) : '-');

/** Nada warna badge: ok (hijau), warn (kuning), bad (merah), muted. */
export function tone(group, value) {
  const map = {
    kondisi: { baik: 'ok', rusak_ringan: 'warn', rusak_berat: 'bad' },
    status_kepegawaian: { aktif: 'ok', pensiun: 'muted', mutasi: 'warn', nonaktif: 'muted' },
    status_pemakaian: { aktif: 'ok', selesai: 'muted' },
    status_jadwal: { terlambat: 'bad', segera: 'warn', terjadwal: 'ok' },
  };
  return map[group]?.[value] ?? 'muted';
}

export const STATUS_JADWAL_LABEL = { terlambat: 'Terlambat', segera: 'Segera servis', terjadwal: 'Terjadwal' };

/** Status jatuh tempo dokumen (STNK/pajak): bad bila lewat, warn bila ≤ 30 hari. */
export function jatuhTempo(date) {
  if (!date) return { tone: 'muted', text: '-' };
  const days = Math.round((Date.parse(date) - Date.parse(today())) / 864e5);
  if (days < 0) return { tone: 'bad', text: `${tanggal(date)}, lewat ${-days} hari` };
  if (days <= 30) return { tone: 'warn', text: `${tanggal(date)}, ${days} hari lagi` };
  return { tone: 'ok', text: tanggal(date) };
}

export const kendaraan = (k) => [k.merek, k.tipe].filter(Boolean).join(' ');
