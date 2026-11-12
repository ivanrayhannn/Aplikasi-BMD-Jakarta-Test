// Fitur 04 (Riwayat Perawatan): catat/ubah/hapus servis, jadwal servis berikutnya,
// rekap biaya, dan sinkronisasi kondisi kendaraan dari catatan terbaru.
import { send, invalid, notFound, paginate, Where } from '../http.js';
import { findOr404, insert, update, diff, transaction } from '../db.js';
import { schemas, validate, today } from '../../shared/validation.js';
import { getSettings } from './pengaturan.js';

const ENTITY = 'Catatan perawatan';
const SELECT = 'r.*, k.nomor_polisi, k.merek, k.tipe, k.perangkat_daerah_id';
const FROM = 'kdo_perawatan r JOIN kdo k ON k.id = r.kdo_id';
const LATEST_ORDER = 'tanggal_servis DESC, id DESC';

function parse(db, body) {
  const { data, errors } = validate(schemas.perawatan, body);
  if (errors) throw invalid(errors);
  if (!db.prepare('SELECT id FROM kdo WHERE id = ?').get(data.kdo_id)) throw invalid({ kdo_id: 'Kendaraan tidak ditemukan' });
  if (data.jadwal_berikutnya && data.jadwal_berikutnya <= data.tanggal_servis) {
    throw invalid({ jadwal_berikutnya: 'Jadwal servis berikutnya harus setelah tanggal servis' });
  }
  return data;
}

/**
 * Kondisi kendaraan mengikuti kondisi_setelah dari catatan perawatan TERBARU (fitur 04 "Kondisi Setelah Servis").
 * Catatan susulan bertanggal lebih lama tidak menimpa kondisi terkini.
 */
function syncKondisi(db, kdoId) {
  const latest = db.prepare(`SELECT kondisi_setelah FROM kdo_perawatan WHERE kdo_id = ? ORDER BY ${LATEST_ORDER} LIMIT 1`).get(kdoId);
  if (latest) {
    db.prepare("UPDATE kdo SET kondisi = ?, updated_at = datetime('now') WHERE id = ? AND kondisi <> ?")
      .run(latest.kondisi_setelah, kdoId, latest.kondisi_setelah);
  }
}

/** Kendaraan dengan jadwal servis berikutnya (dari catatan terbaru), diberi status terlambat/segera/terjadwal. */
export function jadwalServis(db, { hanyaPerluServis = false } = {}) {
  const { pengingat_servis_hari: hari } = getSettings(db);
  const now = today();
  const rows = db.prepare(`
    SELECT k.id AS kdo_id, k.nomor_polisi, k.merek, k.tipe, k.kondisi, pd.nama_dinas AS perangkat_daerah,
      r.tanggal_servis AS servis_terakhir, r.jadwal_berikutnya,
      CAST(julianday(r.jadwal_berikutnya) - julianday(?) AS INTEGER) AS sisa_hari
    FROM kdo k
    JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
    JOIN kdo_perawatan r ON r.id = (SELECT id FROM kdo_perawatan WHERE kdo_id = k.id ORDER BY ${LATEST_ORDER} LIMIT 1)
    WHERE k.is_aktif = 1 AND r.jadwal_berikutnya IS NOT NULL
    ORDER BY r.jadwal_berikutnya`).all(now);
  const withStatus = rows.map((r) => ({
    ...r,
    status_jadwal: r.sisa_hari < 0 ? 'terlambat' : r.sisa_hari <= hari ? 'segera' : 'terjadwal',
  }));
  return hanyaPerluServis ? withStatus.filter((r) => r.status_jadwal !== 'terjadwal') : withStatus;
}

export function register(app, { db, log }) {
  app.get('/api/v1/perawatan', (req, res) => {
    const where = new Where()
      .eq('r.kdo_id', req.query.kdo_id)
      .eq('r.jenis_perawatan', req.query.jenis_perawatan)
      .like(['k.nomor_polisi', 'r.bengkel', 'r.deskripsi'], req.query.q);
    const { rows, meta } = paginate(db, { select: SELECT, from: FROM, where, orderBy: 'r.tanggal_servis DESC, r.id DESC', query: req.query });
    // Ringkasan untuk filter yang sama (total biaya tidak terpengaruh paginasi).
    const ringkasan = db.prepare(`SELECT COUNT(*) AS jumlah, COALESCE(SUM(r.biaya), 0) AS total_biaya FROM ${FROM} ${where.sql}`).get(...where.params);
    send(res, rows, { meta: { ...meta, ringkasan } });
  });

  app.get('/api/v1/perawatan/jadwal', (req, res) => {
    send(res, jadwalServis(db, { hanyaPerluServis: req.query.perlu_servis === '1' }), {
      meta: { pengingat_servis_hari: getSettings(db).pengingat_servis_hari, tanggal: today() },
    });
  });

  app.get('/api/v1/perawatan/rekap', (req, res) => {
    const rows = db.prepare(`
      SELECT k.id AS kdo_id, k.nomor_polisi, k.merek, k.tipe, pd.nama_dinas AS perangkat_daerah,
        COUNT(r.id) AS jumlah_servis, COALESCE(SUM(r.biaya), 0) AS total_biaya, MAX(r.tanggal_servis) AS servis_terakhir
      FROM kdo k JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
      JOIN kdo_perawatan r ON r.kdo_id = k.id
      GROUP BY k.id ORDER BY total_biaya DESC, k.nomor_polisi`).all();
    const total = rows.reduce((s, r) => s + r.total_biaya, 0);
    send(res, rows, { meta: { total_biaya: total } });
  });

  app.get('/api/v1/perawatan/:id', (req, res) => {
    const row = db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE r.id = ?`).get(Number(req.params.id));
    if (!row) throw notFound(ENTITY);
    send(res, row);
  });

  app.post('/api/v1/perawatan', (req, res) => {
    const data = parse(db, req.body);
    const id = transaction(db, () => {
      const id = insert(db, 'kdo_perawatan', data);
      syncKondisi(db, data.kdo_id);
      return id;
    });
    log(req, 'CATAT_PERAWATAN', 'kdo', data.kdo_id, { perawatan_id: id, ...data });
    send(res, findOr404(db, 'kdo_perawatan', id), { status: 201 });
  });

  app.put('/api/v1/perawatan/:id', (req, res) => {
    const current = findOr404(db, 'kdo_perawatan', req.params.id, ENTITY);
    const data = parse(db, { ...current, ...req.body, kdo_id: current.kdo_id }); // catatan tidak dipindah antar kendaraan
    transaction(db, () => {
      update(db, 'kdo_perawatan', current.id, data);
      syncKondisi(db, current.kdo_id);
    });
    log(req, 'UBAH_PERAWATAN', 'kdo', current.kdo_id, { perawatan_id: current.id, ...diff(current, data) });
    send(res, findOr404(db, 'kdo_perawatan', current.id));
  });

  app.delete('/api/v1/perawatan/:id', (req, res) => {
    const current = findOr404(db, 'kdo_perawatan', req.params.id, ENTITY);
    transaction(db, () => {
      db.prepare('DELETE FROM kdo_perawatan WHERE id = ?').run(current.id);
      syncKondisi(db, current.kdo_id);
    });
    log(req, 'HAPUS_PERAWATAN', 'kdo', current.kdo_id, { perawatan_id: current.id, tanggal_servis: current.tanggal_servis, biaya: current.biaya });
    send(res, { id: current.id });
  });
}
