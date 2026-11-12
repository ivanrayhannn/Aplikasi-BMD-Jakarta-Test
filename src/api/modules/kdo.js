// Fitur 08 & 02: CRUD Kendaraan Dinas Operasional (KDO).
// Aturan: nomor_polisi/nomor_rangka/nomor_mesin unik (422); tahun 1980–2100; pemegang wajib PNS aktif (422);
// pemegang dikelola lewat pemakaian (pemakaian.js) agar riwayat selalu terbentuk.
import { send, invalid, conflict, notFound, paginate, Where, boolParam } from '../http.js';
import { findOr404, assertUnique, insert, update, diff, transaction } from '../db.js';
import { schemas, validate, today } from '../../shared/validation.js';
import { activePemakaian, assertPemegangValid, openPemakaian } from './pemakaian.js';

const ENTITY = 'Kendaraan';
const UNIQUE = ['nomor_polisi', 'nomor_rangka', 'nomor_mesin'];

export const KDO_SELECT = `k.*, pd.nama_dinas AS perangkat_daerah, pd.singkatan AS perangkat_daerah_singkatan,
  p.nama_pegawai AS pemegang_nama, p.nip AS pemegang_nip, p.jabatan AS pemegang_jabatan`;
export const KDO_FROM = `kdo k
  JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
  LEFT JOIN pns p ON p.id = k.pemegang_pns_id`;

function parse(db, body) {
  const { data, errors } = validate(schemas.kdo, body);
  if (errors) throw invalid(errors);
  if (!db.prepare('SELECT id FROM perangkat_daerah WHERE id = ?').get(data.perangkat_daerah_id)) {
    throw invalid({ perangkat_daerah_id: 'Perangkat daerah tidak ditemukan' });
  }
  return data;
}

/** Filter daftar kendaraan, dipakai juga oleh laporan agar angka layar & cetak identik. */
export function kdoWhere(query) {
  const where = new Where()
    .like(['k.nomor_polisi', 'k.merek', 'k.tipe', 'p.nama_pegawai'], query.q)
    .eq('k.kondisi', query.kondisi)
    .eq('k.jenis_kendaraan', query.jenis_kendaraan)
    .eq('k.peruntukan', query.peruntukan)
    .eq('k.perangkat_daerah_id', query.perangkat_daerah_id)
    .eq('k.is_aktif', boolParam(query.is_aktif));
  if (query.tanpa_pemegang === '1') where.raw('k.pemegang_pns_id IS NULL');
  return where;
}

export function register(app, { db, log }) {
  app.get('/api/v1/kdo', (req, res) => {
    const { rows, meta } = paginate(db, {
      select: KDO_SELECT, from: KDO_FROM, where: kdoWhere(req.query), orderBy: 'k.nomor_polisi', query: req.query,
    });
    send(res, rows, { meta });
  });

  app.get('/api/v1/kdo/:id', (req, res) => {
    const kdo = db.prepare(`SELECT ${KDO_SELECT} FROM ${KDO_FROM} WHERE k.id = ?`).get(Number(req.params.id));
    if (!kdo) throw notFound(ENTITY);
    kdo.pemakaian_aktif = activePemakaian(db, kdo.id) ?? null;
    kdo.riwayat_pemakaian = db.prepare('SELECT * FROM kdo_pemakaian WHERE kdo_id = ? ORDER BY tanggal_mulai DESC, id DESC').all(kdo.id);
    kdo.perawatan_ringkas = db.prepare(`SELECT COUNT(*) AS jumlah, COALESCE(SUM(biaya), 0) AS total_biaya,
      (SELECT jadwal_berikutnya FROM kdo_perawatan WHERE kdo_id = ? ORDER BY tanggal_servis DESC, id DESC LIMIT 1) AS jadwal_berikutnya
      FROM kdo_perawatan WHERE kdo_id = ?`).get(kdo.id, kdo.id);
    send(res, kdo);
  });

  app.post('/api/v1/kdo', (req, res) => {
    const data = parse(db, req.body);
    assertUnique(db, 'kdo', schemas.kdo, data, UNIQUE);
    const pemegang = data.pemegang_pns_id ? assertPemegangValid(db, data.pemegang_pns_id, 'pemegang_pns_id') : null;
    const id = transaction(db, () => {
      const id = insert(db, 'kdo', { ...data, pemegang_pns_id: null });
      if (pemegang) openPemakaian(db, { ...data, id }, pemegang, { tanggal_mulai: today(), keterangan: 'Ditetapkan saat pendataan kendaraan' });
      return id;
    });
    log(req, 'TAMBAH', 'kdo', id, data);
    send(res, findOr404(db, 'kdo', id), { status: 201 });
  });

  app.put('/api/v1/kdo/:id', (req, res) => {
    const current = findOr404(db, 'kdo', req.params.id, ENTITY);
    const data = parse(db, { ...current, ...req.body });
    assertUnique(db, 'kdo', schemas.kdo, data, UNIQUE, current.id);

    const pemegangBaru = data.pemegang_pns_id;
    const gantiPemegang = pemegangBaru !== current.pemegang_pns_id;
    let pemegang = null;
    if (gantiPemegang) {
      if (activePemakaian(db, current.id)) {
        throw conflict('Kendaraan masih memiliki pemakaian aktif. Tutup pemakaian di menu Pemakai Kendaraan sebelum mengganti pemegang.');
      }
      if (pemegangBaru) pemegang = assertPemegangValid(db, pemegangBaru, 'pemegang_pns_id');
    }
    if (!data.is_aktif && current.is_aktif && activePemakaian(db, current.id)) {
      throw conflict('Kendaraan yang masih dipakai tidak dapat dinonaktifkan. Tutup pemakaiannya terlebih dahulu.');
    }

    transaction(db, () => {
      // pemegang_pns_id hanya diubah lewat openPemakaian agar riwayat selalu terbentuk.
      update(db, 'kdo', current.id, { ...data, pemegang_pns_id: pemegang ? current.pemegang_pns_id : pemegangBaru });
      if (pemegang) openPemakaian(db, { ...data, id: current.id }, pemegang, { tanggal_mulai: today() });
    });
    log(req, 'UBAH', 'kdo', current.id, diff(current, data));
    send(res, findOr404(db, 'kdo', current.id));
  });

  app.delete('/api/v1/kdo/:id', (req, res) => {
    const current = findOr404(db, 'kdo', req.params.id, ENTITY);
    // Riwayat pemakaian & perawatan ikut terhapus (ON DELETE CASCADE, PRD §6).
    const counts = db.prepare(`SELECT
      (SELECT COUNT(*) FROM kdo_pemakaian WHERE kdo_id = ?) AS pemakaian,
      (SELECT COUNT(*) FROM kdo_perawatan WHERE kdo_id = ?) AS perawatan`).get(current.id, current.id);
    db.prepare('DELETE FROM kdo WHERE id = ?').run(current.id);
    log(req, 'HAPUS', 'kdo', current.id, { nomor_polisi: current.nomor_polisi, ...counts });
    send(res, { id: current.id, riwayat_terhapus: counts });
  });
}
