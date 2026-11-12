// Fitur 03 (Pemakai Kendaraan): tautkan pemakai, tutup pemakaian, riwayat pemakaian.
// Sumber kebenaran pemegang kendaraan adalah pemakaian berstatus "aktif";
// kolom kdo.pemegang_pns_id selalu disinkronkan oleh fungsi di modul ini (tidak ada input ganda).
import { send, invalid, conflict, notFound, paginate, Where } from '../http.js';
import { findOr404, insert, transaction } from '../db.js';
import { schemas, validate } from '../../shared/validation.js';

const SELECT = `pk.*, k.nomor_polisi, k.merek, k.tipe, k.perangkat_daerah_id,
  pd.nama_dinas AS perangkat_daerah, p.jabatan AS pns_jabatan`;
const FROM = `kdo_pemakaian pk
  JOIN kdo k ON k.id = pk.kdo_id
  JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
  LEFT JOIN pns p ON p.id = pk.pns_id`;

export function activePemakaian(db, kdoId) {
  return db.prepare("SELECT * FROM kdo_pemakaian WHERE kdo_id = ? AND status = 'aktif'").get(kdoId);
}

/** Pemegang wajib PNS berstatus aktif (PRD §6 aturan relasi) → 422 bila tidak. */
export function assertPemegangValid(db, pnsId, field = 'pns_id') {
  const pns = db.prepare('SELECT * FROM pns WHERE id = ?').get(pnsId);
  if (!pns) throw invalid({ [field]: 'Pegawai tidak ditemukan' });
  if (pns.status_kepegawaian !== 'aktif') {
    throw invalid({ [field]: `${pns.nama_pegawai} berstatus "${pns.status_kepegawaian}". Hanya PNS aktif yang dapat menjadi pemegang kendaraan.` });
  }
  return pns;
}

/**
 * Membuka pemakaian aktif baru dan menyinkronkan kdo.pemegang_pns_id. Panggil di dalam transaksi.
 * @returns {number} id pemakaian
 */
export function openPemakaian(db, kdo, pns, { tanggal_mulai, keterangan = null }) {
  const active = activePemakaian(db, kdo.id);
  if (active) {
    throw conflict(
      `Kendaraan ${kdo.nomor_polisi} masih dipakai oleh ${active.pns_nama} sejak ${active.tanggal_mulai}. ` +
        'Tutup pemakaian tersebut terlebih dahulu sebelum menautkan pegawai lain.',
      { pemakaian_aktif_id: active.id }
    );
  }
  const id = insert(db, 'kdo_pemakaian', {
    kdo_id: kdo.id, pns_id: pns.id, pns_nama: pns.nama_pegawai, pns_nip: pns.nip,
    tanggal_mulai, keterangan, status: 'aktif',
  });
  db.prepare("UPDATE kdo SET pemegang_pns_id = ?, updated_at = datetime('now') WHERE id = ?").run(pns.id, kdo.id);
  return id;
}

export function register(app, { db, log }) {
  app.get('/api/v1/pemakaian', (req, res) => {
    const where = new Where()
      .eq('pk.kdo_id', req.query.kdo_id)
      .eq('pk.pns_id', req.query.pns_id)
      .eq('pk.status', req.query.status)
      .eq('k.perangkat_daerah_id', req.query.perangkat_daerah_id)
      .like(['k.nomor_polisi', 'pk.pns_nama', 'pk.pns_nip'], req.query.q);
    const { rows, meta } = paginate(db, {
      select: SELECT, from: FROM, where, query: req.query,
      orderBy: "CASE pk.status WHEN 'aktif' THEN 0 ELSE 1 END, pk.tanggal_mulai DESC, pk.id DESC",
    });
    send(res, rows, { meta });
  });

  app.get('/api/v1/pemakaian/:id', (req, res) => {
    const row = db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE pk.id = ?`).get(Number(req.params.id));
    if (!row) throw notFound('Pemakaian');
    send(res, row);
  });

  // Tautkan pemakai ke kendaraan.
  app.post('/api/v1/pemakaian', (req, res) => {
    const { data, errors } = validate(schemas.pemakaian, req.body);
    if (errors) throw invalid(errors);
    const kdo = db.prepare('SELECT * FROM kdo WHERE id = ?').get(data.kdo_id);
    if (!kdo) throw invalid({ kdo_id: 'Kendaraan tidak ditemukan' });
    if (!kdo.is_aktif) throw invalid({ kdo_id: `Kendaraan ${kdo.nomor_polisi} berstatus nonaktif` });
    const pns = assertPemegangValid(db, data.pns_id);
    const id = transaction(db, () => openPemakaian(db, kdo, pns, data));
    log(req, 'TAUTKAN_PEMAKAI', 'kdo', kdo.id, { pemakaian_id: id, pns_id: pns.id, tanggal_mulai: data.tanggal_mulai });
    send(res, db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE pk.id = ?`).get(id), { status: 201 });
  });

  // Tutup pemakaian → terbentuk riwayat.
  app.post('/api/v1/pemakaian/:id/selesai', (req, res) => {
    const current = findOr404(db, 'kdo_pemakaian', req.params.id, 'Pemakaian');
    if (current.status !== 'aktif') throw conflict('Pemakaian ini sudah ditutup');
    const { data, errors } = validate(schemas.pemakaianSelesai, req.body);
    if (errors) throw invalid(errors);
    if (data.tanggal_selesai < current.tanggal_mulai) {
      throw invalid({ tanggal_selesai: `Tanggal selesai tidak boleh sebelum tanggal mulai (${current.tanggal_mulai})` });
    }
    transaction(db, () => {
      db.prepare(`UPDATE kdo_pemakaian SET status = 'selesai', tanggal_selesai = ?, keterangan = COALESCE(?, keterangan) WHERE id = ?`)
        .run(data.tanggal_selesai, data.keterangan, current.id);
      db.prepare("UPDATE kdo SET pemegang_pns_id = NULL, updated_at = datetime('now') WHERE id = ?").run(current.kdo_id);
    });
    log(req, 'TUTUP_PEMAKAIAN', 'kdo', current.kdo_id, { pemakaian_id: current.id, tanggal_selesai: data.tanggal_selesai });
    send(res, db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE pk.id = ?`).get(current.id));
  });
}
