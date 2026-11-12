// Fitur 05: Laporan & Cetak. Endpoint mengembalikan baris + ringkasan; pratinjau, cetak, PDF, dan Excel
// di klien dibangun dari respons yang sama sehingga angka di layar dan berkas selalu identik.
import { send, dateRange } from '../http.js';
import { today } from '../../shared/validation.js';
import { KONDISI } from '../../shared/enums.js';
import { KDO_SELECT, KDO_FROM, kdoWhere } from './kdo.js';
import { getSettings } from './pengaturan.js';

const meta = (db, extra) => {
  const s = getSettings(db);
  return { kop: { nama_instansi: s.nama_instansi, alamat: s.alamat, logo_url: s.logo_url }, dicetak_pada: today(), ...extra };
};

export function register(app, { db }) {
  app.get('/api/v1/laporan/kendaraan', (req, res) => {
    const where = kdoWhere({ ...req.query, is_aktif: req.query.is_aktif ?? '1' });
    const rows = db.prepare(`SELECT ${KDO_SELECT} FROM ${KDO_FROM} ${where.sql} ORDER BY pd.nama_dinas, k.nomor_polisi`).all(...where.params);
    const perKondisi = KONDISI.map((k) => ({ kondisi: k.value, jumlah: rows.filter((r) => r.kondisi === k.value).length }));
    send(res, rows, { meta: meta(db, { ringkasan: { per_kondisi: perKondisi, total: rows.length } }) });
  });

  app.get('/api/v1/laporan/pemakaian', (req, res) => {
    const { dari, sampai } = dateRange(req.query);
    const params = [];
    const cond = [];
    // Pemakaian yang beririsan dengan periode: mulai ≤ sampai DAN (masih berjalan ATAU selesai ≥ dari).
    if (sampai) { cond.push('pk.tanggal_mulai <= ?'); params.push(sampai); }
    if (dari) { cond.push('(pk.tanggal_selesai IS NULL OR pk.tanggal_selesai >= ?)'); params.push(dari); }
    if (req.query.perangkat_daerah_id) { cond.push('k.perangkat_daerah_id = ?'); params.push(Number(req.query.perangkat_daerah_id)); }
    const rows = db.prepare(`
      SELECT pk.*, k.nomor_polisi, k.merek, k.tipe, pd.nama_dinas AS perangkat_daerah
      FROM kdo_pemakaian pk JOIN kdo k ON k.id = pk.kdo_id JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY pk.tanggal_mulai DESC, pk.id DESC`).all(...params);
    const aktif = rows.filter((r) => r.status === 'aktif').length;
    send(res, rows, { meta: meta(db, { periode: { dari, sampai }, ringkasan: { total: rows.length, aktif, selesai: rows.length - aktif } }) });
  });

  app.get('/api/v1/laporan/perawatan', (req, res) => {
    const { dari, sampai } = dateRange(req.query);
    const params = [];
    const cond = [];
    if (dari) { cond.push('r.tanggal_servis >= ?'); params.push(dari); }
    if (sampai) { cond.push('r.tanggal_servis <= ?'); params.push(sampai); }
    if (req.query.kdo_id) { cond.push('r.kdo_id = ?'); params.push(Number(req.query.kdo_id)); }
    const rows = db.prepare(`
      SELECT r.*, k.nomor_polisi, k.merek, k.tipe, pd.nama_dinas AS perangkat_daerah
      FROM kdo_perawatan r JOIN kdo k ON k.id = r.kdo_id JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
      ${cond.length ? 'WHERE ' + cond.join(' AND ') : ''}
      ORDER BY k.nomor_polisi, r.tanggal_servis, r.id`).all(...params);
    const perKendaraan = [];
    for (const r of rows) {
      let g = perKendaraan.find((x) => x.kdo_id === r.kdo_id);
      if (!g) perKendaraan.push((g = { kdo_id: r.kdo_id, nomor_polisi: r.nomor_polisi, jumlah: 0, total_biaya: 0 }));
      g.jumlah += 1;
      g.total_biaya += r.biaya;
    }
    perKendaraan.sort((a, b) => b.total_biaya - a.total_biaya);
    const total = rows.reduce((s, r) => s + r.biaya, 0);
    send(res, rows, { meta: meta(db, { periode: { dari, sampai }, ringkasan: { per_kendaraan: perKendaraan, total_biaya: total, jumlah: rows.length } }) });
  });
}
