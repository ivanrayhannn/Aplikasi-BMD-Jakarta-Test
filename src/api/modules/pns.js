// Fitur 08 & 03: CRUD PNS (pegawai calon pemegang kendaraan).
// Aturan: NIP 18 digit unik (422); hapus PNS diizinkan → kdo.pemegang_pns_id menjadi NULL
// (ON DELETE SET NULL) dan pemakaian aktifnya ditutup; status non-aktif ditolak selama masih memegang KDO.
import { send, invalid, conflict, notFound, paginate, Where } from '../http.js';
import { findOr404, assertUnique, insert, update, diff, transaction } from '../db.js';
import { schemas, validate, today } from '../../shared/validation.js';

const ENTITY = 'PNS';

const SELECT = `p.*, pd.nama_dinas AS perangkat_daerah, pd.singkatan AS perangkat_daerah_singkatan,
  (SELECT COUNT(*) FROM kdo WHERE kdo.pemegang_pns_id = p.id) AS jumlah_kdo`;
const FROM = 'pns p JOIN perangkat_daerah pd ON pd.id = p.perangkat_daerah_id';

function parse(db, body) {
  const { data, errors } = validate(schemas.pns, body);
  if (errors) throw invalid(errors);
  const pd = db.prepare('SELECT id FROM perangkat_daerah WHERE id = ?').get(data.perangkat_daerah_id);
  if (!pd) throw invalid({ perangkat_daerah_id: 'Perangkat daerah tidak ditemukan' });
  return data;
}

export function register(app, { db, log }) {
  app.get('/api/v1/pns', (req, res) => {
    const where = new Where()
      .like(['p.nama_pegawai', 'p.nip', 'p.jabatan'], req.query.q)
      .eq('p.status_kepegawaian', req.query.status_kepegawaian)
      .eq('p.perangkat_daerah_id', req.query.perangkat_daerah_id);
    const { rows, meta } = paginate(db, { select: SELECT, from: FROM, where, orderBy: 'p.nama_pegawai', query: req.query });
    send(res, rows, { meta });
  });

  app.get('/api/v1/pns/:id', (req, res) => {
    const pns = db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE p.id = ?`).get(Number(req.params.id));
    if (!pns) throw notFound(ENTITY);
    pns.kdo_dipegang = db.prepare(`SELECT id, nomor_polisi, merek, tipe, kondisi FROM kdo WHERE pemegang_pns_id = ? ORDER BY nomor_polisi`).all(pns.id);
    pns.riwayat_pemakaian = db.prepare(`SELECT pk.*, k.nomor_polisi, k.merek, k.tipe FROM kdo_pemakaian pk
      JOIN kdo k ON k.id = pk.kdo_id WHERE pk.pns_id = ? ORDER BY pk.tanggal_mulai DESC, pk.id DESC`).all(pns.id);
    send(res, pns);
  });

  app.post('/api/v1/pns', (req, res) => {
    const data = parse(db, req.body);
    assertUnique(db, 'pns', schemas.pns, data, ['nip']);
    const id = insert(db, 'pns', data);
    log(req, 'TAMBAH', 'pns', id, data);
    send(res, findOr404(db, 'pns', id), { status: 201 });
  });

  app.put('/api/v1/pns/:id', (req, res) => {
    const current = findOr404(db, 'pns', req.params.id, ENTITY);
    const data = parse(db, { ...current, ...req.body });
    assertUnique(db, 'pns', schemas.pns, data, ['nip'], current.id);
    if (data.status_kepegawaian !== 'aktif') {
      const { n } = db.prepare('SELECT COUNT(*) AS n FROM kdo WHERE pemegang_pns_id = ?').get(current.id);
      if (n) {
        throw conflict(`Pegawai masih memegang ${n} kendaraan. Tutup pemakaiannya terlebih dahulu sebelum mengubah status menjadi "${data.status_kepegawaian}".`, { kdo: n });
      }
    }
    update(db, 'pns', current.id, data);
    log(req, 'UBAH', 'pns', current.id, diff(current, data));
    send(res, findOr404(db, 'pns', current.id));
  });

  app.delete('/api/v1/pns/:id', (req, res) => {
    const current = findOr404(db, 'pns', req.params.id, ENTITY);
    const released = transaction(db, () => {
      // Tutup pemakaian aktif agar riwayat tetap lengkap; potret nama/NIP di kdo_pemakaian dipertahankan.
      const closed = db.prepare(`UPDATE kdo_pemakaian SET status = 'selesai', tanggal_selesai = MAX(tanggal_mulai, ?),
        keterangan = TRIM(COALESCE(keterangan, '') || ' [ditutup otomatis: data PNS dihapus]')
        WHERE pns_id = ? AND status = 'aktif'`).run(today(), current.id).changes;
      db.prepare('DELETE FROM pns WHERE id = ?').run(current.id); // FK: kdo.pemegang_pns_id → NULL
      return closed;
    });
    log(req, 'HAPUS', 'pns', current.id, { nip: current.nip, nama_pegawai: current.nama_pegawai, kdo_dilepas: released });
    send(res, { id: current.id, kdo_dilepas: released });
  });
}
