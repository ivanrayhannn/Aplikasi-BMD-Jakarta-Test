// Fitur 08: CRUD Perangkat Daerah.
// Aturan: kode & nama_dinas unik (422); hapus ditolak 409 bila masih punya PNS/KDO.
import { send, invalid, conflict, notFound, paginate, Where, boolParam } from '../http.js';
import { findOr404, assertUnique, insert, update, diff } from '../db.js';
import { schemas, validate } from '../../shared/validation.js';

const ENTITY = 'Perangkat daerah';
const UNIQUE = ['kode', 'nama_dinas'];

const SELECT = `pd.*,
  (SELECT COUNT(*) FROM pns WHERE pns.perangkat_daerah_id = pd.id) AS jumlah_pns,
  (SELECT COUNT(*) FROM kdo WHERE kdo.perangkat_daerah_id = pd.id) AS jumlah_kdo`;

function parse(body) {
  const { data, errors } = validate(schemas.perangkatDaerah, body);
  if (errors) throw invalid(errors);
  return data;
}

export function register(app, { db, log }) {
  app.get('/api/v1/perangkat-daerah', (req, res) => {
    const where = new Where()
      .like(['pd.kode', 'pd.nama_dinas', 'pd.singkatan'], req.query.q)
      .eq('pd.is_aktif', boolParam(req.query.is_aktif));
    const { rows, meta } = paginate(db, { select: SELECT, from: 'perangkat_daerah pd', where, orderBy: 'pd.kode', query: req.query });
    send(res, rows, { meta });
  });

  app.get('/api/v1/perangkat-daerah/:id', (req, res) => {
    const pd = db.prepare(`SELECT ${SELECT} FROM perangkat_daerah pd WHERE pd.id = ?`).get(Number(req.params.id));
    if (!pd) throw notFound(ENTITY);
    pd.pns = db.prepare(`SELECT id, nip, nama_pegawai, jabatan, golongan, status_kepegawaian FROM pns
      WHERE perangkat_daerah_id = ? ORDER BY nama_pegawai`).all(pd.id);
    pd.kdo = db.prepare(`SELECT k.id, k.nomor_polisi, k.merek, k.tipe, k.jenis_kendaraan, k.kondisi, k.is_aktif, p.nama_pegawai AS pemegang_nama
      FROM kdo k LEFT JOIN pns p ON p.id = k.pemegang_pns_id WHERE k.perangkat_daerah_id = ? ORDER BY k.nomor_polisi`).all(pd.id);
    send(res, pd);
  });

  app.post('/api/v1/perangkat-daerah', (req, res) => {
    const data = parse(req.body);
    assertUnique(db, 'perangkat_daerah', schemas.perangkatDaerah, data, UNIQUE);
    const id = insert(db, 'perangkat_daerah', data);
    log(req, 'TAMBAH', 'perangkat_daerah', id, data);
    send(res, findOr404(db, 'perangkat_daerah', id), { status: 201 });
  });

  app.put('/api/v1/perangkat-daerah/:id', (req, res) => {
    const current = findOr404(db, 'perangkat_daerah', req.params.id, ENTITY);
    const data = parse({ ...current, ...req.body });
    assertUnique(db, 'perangkat_daerah', schemas.perangkatDaerah, data, UNIQUE, current.id);
    update(db, 'perangkat_daerah', current.id, data);
    log(req, 'UBAH', 'perangkat_daerah', current.id, diff(current, data));
    send(res, findOr404(db, 'perangkat_daerah', current.id));
  });

  app.delete('/api/v1/perangkat-daerah/:id', (req, res) => {
    const current = findOr404(db, 'perangkat_daerah', req.params.id, ENTITY);
    const blockers = db.prepare(`SELECT
      (SELECT COUNT(*) FROM pns WHERE perangkat_daerah_id = ?) AS pns,
      (SELECT COUNT(*) FROM kdo WHERE perangkat_daerah_id = ?) AS kdo`).get(current.id, current.id);
    if (blockers.pns || blockers.kdo) {
      throw conflict(
        `${current.nama_dinas} tidak dapat dihapus karena masih memiliki ${blockers.pns} PNS dan ${blockers.kdo} kendaraan. ` +
          'Pindahkan atau hapus data tersebut terlebih dahulu, atau nonaktifkan perangkat daerah ini.',
        blockers
      );
    }
    db.prepare('DELETE FROM perangkat_daerah WHERE id = ?').run(current.id);
    log(req, 'HAPUS', 'perangkat_daerah', current.id, { kode: current.kode, nama_dinas: current.nama_dinas });
    send(res, { id: current.id });
  });
}
