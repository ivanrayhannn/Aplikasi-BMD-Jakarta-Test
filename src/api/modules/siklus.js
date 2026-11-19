// Siklus hidup aset (PRD 9.H): pengadaan, penugasan, pengembalian, mutasi, disposal, dan berita acara.
// Aturan: BR-22 approval oleh Approver (bukan pemohon), BR-23 setiap perpindahan tanggung jawab berbukti
// berita acara bernomor, BR-24 pengembalian wajib pemeriksaan unit, BR-25 disposal hanya untuk aset tanpa pemegang,
// BR-26 pegawai hanya melihat kendaraan dan pengajuannya sendiri.
import { send, invalid, conflict, notFound, forbidden, paginate, Where } from '../http.js';
import { findOr404, insert, update, transaction } from '../db.js';
import { schemas, validate, today } from '../../shared/validation.js';
import { JENIS_BERITA_ACARA, KELENGKAPAN, KONDISI, labelOf } from '../../shared/enums.js';
import { activePemakaian, assertPemegangValid, openPemakaian } from './pemakaian.js';

const PREFIX = { pengadaan: 'PGD', penugasan: 'PNG', pengembalian: 'PKB', mutasi: 'MTS', disposal: 'DSP' };
const BA_PREFIX = { serah_terima: 'BAST', pengembalian: 'BAPK', mutasi: 'BAMT', penghapusan: 'BAPH', penerimaan: 'BAPB' };
const OPEN = ['diajukan', 'disetujui', 'dipesan', 'diterima'];
const BUTUH_APPROVAL = ['pengadaan', 'penugasan', 'mutasi', 'disposal'];

/** Nomor urut per prefix dan tahun, mis. PNG/2026/0003. */
function nextNomor(db, table, prefix, tanggal) {
  const year = (tanggal || today()).slice(0, 4);
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE nomor LIKE ?`).get(`${prefix}/%/${year}/%`);
  return `${prefix}/KDO/${year}/${String(n + 1).padStart(4, '0')}`;
}

export function createBeritaAcara(db, { jenis, tanggal, kdo_id = null, pengajuan_id = null, pihak_pertama, pihak_kedua, uraian, dibuat_oleh = null }) {
  const nomor = nextNomor(db, 'berita_acara', BA_PREFIX[jenis], tanggal);
  const id = insert(db, 'berita_acara', { nomor, jenis, tanggal, kdo_id, pengajuan_id, pihak_pertama, pihak_kedua, uraian, dibuat_oleh });
  return { id, nomor };
}

const daftarKelengkapan = (list) => (list?.length ? list.map((v) => labelOf(KELENGKAPAN, v)).join(', ') : 'tidak ada');
const kendaraanText = (k) => `${k.nomor_polisi} (${[k.merek, k.tipe].filter(Boolean).join(' ')})`;

/** Serah terima kendaraan ke pemegang: penugasan aktif, status Aktif, BAST. Panggil di dalam transaksi. */
export function assignAsset(db, kdo, pns, { tanggal, diserahkan_oleh, catatan = null, pengajuan_id = null, userId = null }) {
  if (['dihapuskan', 'rusak'].includes(kdo.status_aset)) {
    throw invalid({ kdo_id: `Kendaraan ${kdo.nomor_polisi} berstatus ${kdo.status_aset} dan tidak dapat diserahkan` });
  }
  const pemakaianId = openPemakaian(db, kdo, pns, { tanggal_mulai: tanggal, keterangan: catatan });
  const ba = createBeritaAcara(db, {
    jenis: 'serah_terima', tanggal, kdo_id: kdo.id, pengajuan_id, dibuat_oleh: userId,
    pihak_pertama: diserahkan_oleh, pihak_kedua: `${pns.nama_pegawai} (NIP ${pns.nip})`,
    uraian: `Serah terima kendaraan dinas ${kendaraanText(kdo)} untuk dipergunakan dan dipertanggungjawabkan oleh pihak kedua.${catatan ? ' ' + catatan : ''}`,
  });
  return { pemakaianId, ba };
}

/** Pengembalian: tutup penugasan, catat pemeriksaan, perbarui kondisi dan status, BA pengembalian. Panggil di dalam transaksi. */
export function returnAsset(db, kdo, data, userId = null) {
  const active = activePemakaian(db, kdo.id);
  if (!active) throw conflict(`Kendaraan ${kdo.nomor_polisi} tidak sedang dipegang siapa pun`);
  if (data.tanggal_kembali < active.tanggal_mulai) {
    throw invalid({ tanggal_kembali: `Tanggal kembali tidak boleh sebelum tanggal mulai penugasan (${active.tanggal_mulai})` });
  }
  const kelengkapan = data.kelengkapan ?? [];
  const ba = createBeritaAcara(db, {
    jenis: 'pengembalian', tanggal: data.tanggal_kembali, kdo_id: kdo.id, pengajuan_id: data.pengajuan_id ?? null, dibuat_oleh: userId,
    pihak_pertama: `${active.pns_nama} (NIP ${active.pns_nip})`, pihak_kedua: data.diterima_oleh,
    uraian: `Pengembalian kendaraan dinas ${kendaraanText(kdo)}. Alasan: ${data.alasan}. Hasil pemeriksaan: kondisi ${labelOf(KONDISI, data.kondisi_hasil_cek).toLowerCase()}`
      + `${data.kilometer != null ? `, kilometer ${data.kilometer}` : ''}, kelengkapan ${daftarKelengkapan(kelengkapan)}.`
      + `${data.catatan_pemeriksaan ? ' ' + data.catatan_pemeriksaan : ''}`,
  });
  const id = insert(db, 'kdo_pengembalian', {
    kdo_id: kdo.id, pemakaian_id: active.id, pengajuan_id: data.pengajuan_id ?? null, berita_acara_id: ba.id,
    tanggal_kembali: data.tanggal_kembali, alasan: data.alasan, kondisi_hasil_cek: data.kondisi_hasil_cek,
    kilometer: data.kilometer ?? null, kelengkapan: JSON.stringify(kelengkapan), catatan_pemeriksaan: data.catatan_pemeriksaan ?? null,
    diserahkan_oleh: active.pns_nama, diterima_oleh: data.diterima_oleh,
  });
  db.prepare("UPDATE kdo_pemakaian SET status = 'selesai', tanggal_selesai = ?, keterangan = COALESCE(keterangan || '; ', '') || ? WHERE id = ?")
    .run(data.tanggal_kembali, `Dikembalikan (${ba.nomor})`, active.id);
  // BR-24: kondisi hasil pemeriksaan menjadi kondisi kendaraan; rusak berat tidak bisa langsung diserahkan lagi.
  update(db, 'kdo', kdo.id, {
    pemegang_pns_id: null, kondisi: data.kondisi_hasil_cek,
    status_aset: data.kondisi_hasil_cek === 'rusak_berat' ? 'rusak' : 'siaga',
  });
  return { id, ba };
}

const SELECT = `pg.*, k.nomor_polisi, k.merek, k.tipe, k.status_aset, k.pemegang_pns_id AS kdo_pemegang_pns_id,
  p.nama_pegawai AS pns_nama, p.nip AS pns_nip, pd.nama_dinas AS perangkat_daerah, pd.singkatan AS perangkat_daerah_singkatan,
  ua.nama AS diajukan_oleh_nama, up.nama AS diputus_oleh_nama, us.nama AS diselesaikan_oleh_nama`;
const FROM = `pengajuan pg
  LEFT JOIN kdo k ON k.id = pg.kdo_id
  LEFT JOIN pns p ON p.id = pg.pns_id
  LEFT JOIN perangkat_daerah pd ON pd.id = pg.perangkat_daerah_id
  LEFT JOIN users ua ON ua.id = pg.diajukan_oleh
  LEFT JOIN users up ON up.id = pg.diputus_oleh
  LEFT JOIN users us ON us.id = pg.diselesaikan_oleh`;

const parse = (row) => row && { ...row, detail: JSON.parse(row.detail || '{}') };
export const getPengajuan = (db, id) => parse(db.prepare(`SELECT ${SELECT} FROM ${FROM} WHERE pg.id = ?`).get(Number(id)));

/** Pegawai hanya boleh melihat pengajuan yang ia buat atau yang ditujukan untuknya (BR-26). */
function assertCanSee(req, row) {
  if (req.user.role !== 'pegawai') return;
  if (row.diajukan_oleh !== req.user.id && row.pns_id !== req.user.pns_id) throw forbidden('Pengajuan ini bukan milik Anda');
}

function assertKdo(db, id, field = 'kdo_id') {
  const kdo = db.prepare('SELECT * FROM kdo WHERE id = ?').get(id);
  if (!kdo) throw invalid({ [field]: 'Kendaraan tidak ditemukan' });
  if (kdo.status_aset === 'dihapuskan' || !kdo.is_aktif) throw invalid({ [field]: `Kendaraan ${kdo.nomor_polisi} sudah tidak aktif` });
  return kdo;
}

function assertNoOpen(db, jenis, kdoId) {
  if (!kdoId) return;
  const open = db.prepare(`SELECT nomor FROM pengajuan WHERE jenis = ? AND kdo_id = ? AND status IN (${OPEN.map(() => '?').join(',')})`)
    .get(jenis, kdoId, ...OPEN);
  if (open) throw conflict(`Masih ada pengajuan ${jenis} yang berjalan untuk kendaraan ini (${open.nomor})`, { nomor: open.nomor });
}

/** Membuat pengajuan dari input tervalidasi. Dipakai API dan data uji. */
export function createPengajuan(db, data, user, { diajukan_pada = null } = {}) {
  const role = user.role;
  if (role === 'pegawai' && !['penugasan', 'pengembalian'].includes(data.jenis)) {
    throw forbidden('Pegawai hanya dapat mengajukan penugasan kendaraan atau pengembalian aset');
  }
  const row = { jenis: data.jenis, alasan: data.alasan, kdo_id: null, pns_id: null, perangkat_daerah_id: null, detail: {} };

  if (data.jenis === 'pengadaan') {
    const errors = {};
    if (!data.perangkat_daerah_id) errors.perangkat_daerah_id = 'Unit pemohon wajib diisi';
    if (!data.jenis_kendaraan) errors.jenis_kendaraan = 'Jenis kendaraan wajib diisi';
    if (Object.keys(errors).length) throw invalid(errors);
    row.perangkat_daerah_id = data.perangkat_daerah_id;
    row.detail = { jenis_kendaraan: data.jenis_kendaraan, jumlah: data.jumlah ?? 1, spesifikasi: data.spesifikasi, estimasi_biaya: data.estimasi_biaya, tanggal_dibutuhkan: data.tanggal_dibutuhkan };
  }

  if (data.jenis === 'penugasan') {
    const pnsId = role === 'pegawai' ? user.pns_id : data.pns_id;
    if (!pnsId) throw invalid({ pns_id: 'Pegawai pemohon wajib diisi' });
    const pns = assertPemegangValid(db, pnsId);
    if (data.kdo_id) {
      const kdo = assertKdo(db, data.kdo_id);
      if (kdo.pemegang_pns_id) throw invalid({ kdo_id: `Kendaraan ${kdo.nomor_polisi} masih dipegang pegawai lain` });
      row.kdo_id = kdo.id;
    }
    row.pns_id = pns.id;
    row.perangkat_daerah_id = pns.perangkat_daerah_id;
    row.detail = { jenis_kendaraan: data.jenis_kendaraan, tanggal_dibutuhkan: data.tanggal_dibutuhkan };
    const open = db.prepare(`SELECT nomor FROM pengajuan WHERE jenis = 'penugasan' AND pns_id = ? AND status IN ('diajukan','disetujui')`).get(pns.id);
    if (open) throw conflict(`${pns.nama_pegawai} masih punya pengajuan penugasan yang berjalan (${open.nomor})`, { nomor: open.nomor });
  }

  if (data.jenis === 'pengembalian') {
    if (!data.kdo_id) throw invalid({ kdo_id: 'Kendaraan wajib dipilih' });
    const kdo = assertKdo(db, data.kdo_id);
    if (!kdo.pemegang_pns_id) throw invalid({ kdo_id: `Kendaraan ${kdo.nomor_polisi} tidak sedang dipegang` });
    if (role === 'pegawai' && kdo.pemegang_pns_id !== user.pns_id) throw forbidden('Anda hanya dapat mengembalikan kendaraan yang Anda pegang');
    row.kdo_id = kdo.id;
    row.pns_id = kdo.pemegang_pns_id;
    row.perangkat_daerah_id = kdo.perangkat_daerah_id;
  }

  if (data.jenis === 'mutasi') {
    if (!data.kdo_id) throw invalid({ kdo_id: 'Kendaraan wajib dipilih' });
    const kdo = assertKdo(db, data.kdo_id);
    const pdBaru = data.perangkat_daerah_id && data.perangkat_daerah_id !== kdo.perangkat_daerah_id ? data.perangkat_daerah_id : null;
    const pnsBaru = data.pns_id && data.pns_id !== kdo.pemegang_pns_id ? assertPemegangValid(db, data.pns_id).id : null;
    const lokasiBaru = data.lokasi_tujuan && data.lokasi_tujuan !== kdo.lokasi ? data.lokasi_tujuan : null;
    if (!pdBaru && !pnsBaru && !lokasiBaru) {
      throw invalid({ perangkat_daerah_id: 'Isi minimal satu tujuan mutasi: perangkat daerah, pemegang, atau lokasi yang berbeda dari sekarang' });
    }
    if (pdBaru && !db.prepare('SELECT id FROM perangkat_daerah WHERE id = ? AND is_aktif = 1').get(pdBaru)) {
      throw invalid({ perangkat_daerah_id: 'Perangkat daerah tujuan tidak ditemukan atau nonaktif' });
    }
    row.kdo_id = kdo.id;
    row.pns_id = pnsBaru;
    row.perangkat_daerah_id = pdBaru;
    row.detail = { lokasi_tujuan: lokasiBaru, perangkat_daerah_asal_id: kdo.perangkat_daerah_id, pemegang_asal_id: kdo.pemegang_pns_id, lokasi_asal: kdo.lokasi };
  }

  if (data.jenis === 'disposal') {
    if (!data.kdo_id) throw invalid({ kdo_id: 'Kendaraan wajib dipilih' });
    if (!data.metode) throw invalid({ metode: 'Metode disposal wajib dipilih' });
    const kdo = assertKdo(db, data.kdo_id);
    if (kdo.pemegang_pns_id) throw conflict(`Kendaraan ${kdo.nomor_polisi} masih dipegang. Proses pengembalian aset terlebih dahulu.`);
    row.kdo_id = kdo.id;
    row.perangkat_daerah_id = kdo.perangkat_daerah_id;
    row.detail = { metode: data.metode, nilai_taksiran: data.nilai_taksiran, nilai_buku: kdo.nilai_perolehan };
  }

  assertNoOpen(db, data.jenis, row.jenis === 'penugasan' ? null : row.kdo_id);
  const tanggal = (diajukan_pada || today()).slice(0, 10);
  const id = insert(db, 'pengajuan', {
    ...row, detail: JSON.stringify(row.detail), nomor: nextNomor(db, 'pengajuan', PREFIX[data.jenis], tanggal),
    diajukan_oleh: user.id, diajukan_pada: diajukan_pada || new Date().toISOString().slice(0, 19).replace('T', ' '),
    // Pengembalian tidak memerlukan approval: langsung siap diproses admin.
    ...(BUTUH_APPROVAL.includes(data.jenis) ? {} : { status: 'disetujui', catatan_keputusan: 'Pengembalian tidak memerlukan persetujuan' }),
  });
  return id;
}

/** Keputusan approver (BR-22). */
export function decide(db, pg, user, setuju, catatan) {
  if (pg.status !== 'diajukan') throw conflict(`Pengajuan ${pg.nomor} sudah berstatus ${pg.status}`);
  if (pg.diajukan_oleh === user.id) throw forbidden('Approver tidak dapat memutus pengajuan yang ia ajukan sendiri');
  if (!setuju && !catatan) throw invalid({ catatan: 'Alasan penolakan wajib diisi' });
  db.prepare(`UPDATE pengajuan SET status = ?, diputus_oleh = ?, diputus_pada = datetime('now'), catatan_keputusan = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(setuju ? 'disetujui' : 'ditolak', user.id, catatan ?? null, pg.id);
}

const finish = (db, id, userId, extra = {}) => update(db, 'pengajuan', id, {
  status: 'selesai', diselesaikan_oleh: userId, diselesaikan_pada: new Date().toISOString().slice(0, 19).replace('T', ' '), ...extra,
});

/** Tahap proses admin setelah disetujui. Mengembalikan ringkasan untuk log. */
export function prosesPengajuan(db, pg, body, user) {
  const userId = user.id;
  const merge = (extra) => JSON.stringify({ ...pg.detail, ...extra });

  if (pg.jenis === 'penugasan' && pg.status === 'disetujui') {
    const { data, errors } = validate(schemas.prosesPenugasan, body);
    if (errors) throw invalid(errors);
    if (pg.kdo_id && data.kdo_id !== pg.kdo_id) throw invalid({ kdo_id: 'Kendaraan harus sesuai pengajuan yang disetujui' });
    const kdo = assertKdo(db, data.kdo_id);
    const pns = assertPemegangValid(db, pg.pns_id);
    const { ba } = assignAsset(db, kdo, pns, { tanggal: data.tanggal, diserahkan_oleh: data.diserahkan_oleh, catatan: data.catatan, pengajuan_id: pg.id, userId });
    finish(db, pg.id, userId, { kdo_id: kdo.id });
    return { berita_acara: ba.nomor };
  }

  if (pg.jenis === 'mutasi' && pg.status === 'disetujui') {
    const { data, errors } = validate(schemas.prosesMutasi, body);
    if (errors) throw invalid(errors);
    const kdo = assertKdo(db, pg.kdo_id);
    const perubahan = [];
    if (pg.perangkat_daerah_id) {
      const pd = db.prepare('SELECT nama_dinas FROM perangkat_daerah WHERE id = ?').get(pg.perangkat_daerah_id);
      update(db, 'kdo', kdo.id, { perangkat_daerah_id: pg.perangkat_daerah_id });
      perubahan.push(`perangkat daerah menjadi ${pd.nama_dinas}`);
    }
    if (pg.detail.lokasi_tujuan) {
      update(db, 'kdo', kdo.id, { lokasi: pg.detail.lokasi_tujuan });
      perubahan.push(`lokasi menjadi ${pg.detail.lokasi_tujuan}`);
    }
    if (pg.pns_id) {
      const active = activePemakaian(db, kdo.id);
      if (active) {
        db.prepare("UPDATE kdo_pemakaian SET status = 'selesai', tanggal_selesai = ?, keterangan = COALESCE(keterangan || '; ', '') || ? WHERE id = ?")
          .run(data.tanggal < active.tanggal_mulai ? active.tanggal_mulai : data.tanggal, `Mutasi ${pg.nomor}`, active.id);
        db.prepare('UPDATE kdo SET pemegang_pns_id = NULL WHERE id = ?').run(kdo.id);
      }
      const pns = assertPemegangValid(db, pg.pns_id);
      openPemakaian(db, { ...kdo, pemegang_pns_id: null }, pns, { tanggal_mulai: data.tanggal, keterangan: `Mutasi ${pg.nomor}` });
      perubahan.push(`pemegang menjadi ${pns.nama_pegawai}`);
    }
    const ba = createBeritaAcara(db, {
      jenis: 'mutasi', tanggal: data.tanggal, kdo_id: kdo.id, pengajuan_id: pg.id, dibuat_oleh: userId,
      pihak_pertama: data.diserahkan_oleh, pihak_kedua: data.diterima_oleh,
      uraian: `Mutasi kendaraan dinas ${kendaraanText(kdo)}: ${perubahan.join('; ')}.${data.catatan ? ' ' + data.catatan : ''}`,
    });
    finish(db, pg.id, userId);
    return { berita_acara: ba.nomor };
  }

  if (pg.jenis === 'disposal' && pg.status === 'disetujui') {
    const { data, errors } = validate(schemas.prosesDisposal, body);
    if (errors) throw invalid(errors);
    const kdo = assertKdo(db, pg.kdo_id);
    if (kdo.pemegang_pns_id) throw conflict(`Kendaraan ${kdo.nomor_polisi} masih dipegang. Proses pengembalian aset terlebih dahulu.`);
    update(db, 'kdo', kdo.id, { status_aset: 'dihapuskan', is_aktif: 0 });
    const ba = createBeritaAcara(db, {
      jenis: 'penghapusan', tanggal: data.tanggal, kdo_id: kdo.id, pengajuan_id: pg.id, dibuat_oleh: userId,
      pihak_pertama: user.nama, pihak_kedua: data.pembeli || 'Dimusnahkan',
      uraian: `Penghapusan kendaraan dinas ${kendaraanText(kdo)} melalui ${pg.detail.metode} dengan nilai Rp${data.nilai_jual.toLocaleString('id-ID')}, dokumen ${data.nomor_dokumen}.${data.catatan ? ' ' + data.catatan : ''}`,
    });
    finish(db, pg.id, userId, { detail: merge({ ...data, tanggal_pelaksanaan: data.tanggal }) });
    return { berita_acara: ba.nomor, nilai_jual: data.nilai_jual };
  }

  if (pg.jenis === 'pengadaan' && pg.status === 'disetujui') {
    const { data, errors } = validate(schemas.prosesPo, body);
    if (errors) throw invalid(errors);
    update(db, 'pengajuan', pg.id, { status: 'dipesan', detail: merge(data) });
    return { nomor_po: data.nomor_po };
  }

  if (pg.jenis === 'pengadaan' && pg.status === 'dipesan') {
    const { data, errors } = validate(schemas.prosesPenerimaan, body);
    if (errors) throw invalid(errors);
    const ba = createBeritaAcara(db, {
      jenis: 'penerimaan', tanggal: data.tanggal_terima, pengajuan_id: pg.id, dibuat_oleh: userId,
      pihak_pertama: data.diserahkan_oleh, pihak_kedua: user.nama,
      uraian: `Penerimaan ${pg.detail.jumlah ?? 1} unit kendaraan sesuai PO ${pg.detail.nomor_po}. Kelengkapan: ${daftarKelengkapan(data.kelengkapan)}.${data.catatan ? ' ' + data.catatan : ''}`,
    });
    update(db, 'pengajuan', pg.id, { status: 'diterima', detail: merge({ ...data, kdo_ids: [] }) });
    return { berita_acara: ba.nomor };
  }

  if (pg.jenis === 'pengadaan' && pg.status === 'diterima') {
    throw conflict('Unit sudah diterima. Lanjutkan dengan Registrasi Aset (tambah kendaraan dari pengajuan ini).');
  }
  if (pg.jenis === 'pengembalian') throw conflict('Proses pengembalian lewat form Pengembalian Aset (POST /pengembalian).');
  throw conflict(`Pengajuan ${pg.nomor} berstatus ${pg.status} dan tidak dapat diproses`);
}

/** Registrasi aset hasil pengadaan: dipanggil modul kdo setelah kendaraan baru disimpan. */
export function registrasiPengadaan(db, pengajuanId, kdoId, userId) {
  const pg = getPengajuan(db, pengajuanId);
  if (!pg || pg.jenis !== 'pengadaan') throw invalid({ pengajuan_id: 'Pengajuan pengadaan tidak ditemukan' });
  if (pg.status !== 'diterima') throw invalid({ pengajuan_id: `Pengajuan ${pg.nomor} belum pada tahap registrasi aset` });
  const ids = [...(pg.detail.kdo_ids ?? []), kdoId];
  const detail = JSON.stringify({ ...pg.detail, kdo_ids: ids });
  if (ids.length >= (pg.detail.jumlah ?? 1)) finish(db, pg.id, userId, { detail, kdo_id: kdoId });
  else update(db, 'pengajuan', pg.id, { detail, kdo_id: kdoId });
}

/** Pengajuan beserta berita acara dan kendaraan hasil registrasi, untuk halaman detail. */
function detail(db, id) {
  const pg = getPengajuan(db, id);
  if (!pg) return null;
  pg.berita_acara = db.prepare('SELECT id, nomor, jenis, tanggal FROM berita_acara WHERE pengajuan_id = ? ORDER BY id').all(pg.id);
  const ids = pg.detail.kdo_ids ?? [];
  pg.kendaraan_teregistrasi = ids.length
    ? db.prepare(`SELECT id, nomor_polisi, merek, tipe FROM kdo WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids) : [];
  return pg;
}

export function register(app, { db, log }) {
  app.get('/api/v1/pengajuan', (req, res) => {
    const where = new Where()
      .eq('pg.jenis', req.query.jenis)
      .eq('pg.kdo_id', req.query.kdo_id)
      .like(['pg.nomor', 'pg.alasan', 'k.nomor_polisi', 'p.nama_pegawai'], req.query.q);
    if (req.query.status === 'terbuka') where.raw(`pg.status IN (${OPEN.map((s) => `'${s}'`).join(',')})`);
    else where.eq('pg.status', req.query.status);
    if (req.user.role === 'pegawai') where.raw('(pg.diajukan_oleh = ? OR pg.pns_id = ?)', req.user.id, req.user.pns_id ?? -1);
    const { rows, meta } = paginate(db, {
      select: SELECT, from: FROM, where, query: req.query,
      orderBy: "CASE pg.status WHEN 'diajukan' THEN 0 WHEN 'disetujui' THEN 1 WHEN 'dipesan' THEN 2 WHEN 'diterima' THEN 3 ELSE 4 END, pg.diajukan_pada DESC, pg.id DESC",
    });
    send(res, rows.map(parse), { meta });
  });

  app.get('/api/v1/pengajuan/:id', (req, res) => {
    const pg = detail(db, req.params.id);
    if (!pg) throw notFound('Pengajuan');
    assertCanSee(req, pg);
    send(res, pg);
  });

  app.post('/api/v1/pengajuan', (req, res) => {
    const { data, errors } = validate(schemas.pengajuan, req.body);
    if (errors) throw invalid(errors);
    const id = transaction(db, () => createPengajuan(db, data, req.user));
    const pg = detail(db, id);
    log(req, 'AJUKAN', 'pengajuan', id, { nomor: pg.nomor, jenis: pg.jenis, kdo_id: pg.kdo_id });
    send(res, pg, { status: 201 });
  });

  for (const [path, setuju] of [['setujui', true], ['tolak', false]]) {
    app.post(`/api/v1/pengajuan/:id/${path}`, (req, res) => {
      if (req.user.role !== 'approver') throw forbidden('Hanya Approver yang dapat memutus pengajuan');
      const pg = getPengajuan(db, req.params.id);
      if (!pg) throw notFound('Pengajuan');
      const { data, errors } = validate(schemas.keputusan, req.body);
      if (errors) throw invalid(errors);
      decide(db, pg, req.user, setuju, data.catatan);
      log(req, setuju ? 'SETUJUI' : 'TOLAK', 'pengajuan', pg.id, { nomor: pg.nomor, catatan: data.catatan });
      send(res, detail(db, pg.id));
    });
  }

  app.post('/api/v1/pengajuan/:id/batal', (req, res) => {
    const pg = getPengajuan(db, req.params.id);
    if (!pg) throw notFound('Pengajuan');
    if (req.user.role !== 'admin' && pg.diajukan_oleh !== req.user.id) throw forbidden('Hanya pemohon atau Pengelola Aset yang dapat membatalkan');
    if (!['diajukan', 'disetujui'].includes(pg.status)) throw conflict(`Pengajuan ${pg.nomor} berstatus ${pg.status} dan tidak dapat dibatalkan`);
    update(db, 'pengajuan', pg.id, { status: 'dibatalkan' });
    log(req, 'BATALKAN', 'pengajuan', pg.id, { nomor: pg.nomor });
    send(res, detail(db, pg.id));
  });

  app.post('/api/v1/pengajuan/:id/proses', (req, res) => {
    if (req.user.role !== 'admin') throw forbidden('Hanya Pengelola Aset yang dapat memproses pengajuan');
    const pg = getPengajuan(db, req.params.id);
    if (!pg) throw notFound('Pengajuan');
    const hasil = transaction(db, () => prosesPengajuan(db, pg, req.body, req.user));
    log(req, 'PROSES', 'pengajuan', pg.id, { nomor: pg.nomor, ...hasil });
    send(res, detail(db, pg.id));
  });

  app.get('/api/v1/pengembalian', (req, res) => {
    const where = new Where().eq('r.kdo_id', req.query.kdo_id);
    const { rows, meta } = paginate(db, {
      select: 'r.*, k.nomor_polisi, k.merek, k.tipe, ba.nomor AS berita_acara_nomor',
      from: 'kdo_pengembalian r JOIN kdo k ON k.id = r.kdo_id LEFT JOIN berita_acara ba ON ba.id = r.berita_acara_id',
      where, query: req.query, orderBy: 'r.tanggal_kembali DESC, r.id DESC',
    });
    send(res, rows.map((r) => ({ ...r, kelengkapan: JSON.parse(r.kelengkapan) })), { meta });
  });

  app.post('/api/v1/pengembalian', (req, res) => {
    if (req.user.role !== 'admin') throw forbidden('Hanya Pengelola Aset yang dapat memproses pengembalian aset');
    const { data, errors } = validate(schemas.pengembalian, req.body);
    if (errors) throw invalid(errors);
    const kdo = findOr404(db, 'kdo', data.kdo_id, 'Kendaraan');
    const hasil = transaction(db, () => {
      if (data.pengajuan_id) {
        const pg = getPengajuan(db, data.pengajuan_id);
        if (!pg || pg.jenis !== 'pengembalian' || pg.kdo_id !== kdo.id) throw invalid({ pengajuan_id: 'Pengajuan pengembalian tidak sesuai kendaraan ini' });
        if (pg.status !== 'disetujui') throw conflict(`Pengajuan ${pg.nomor} berstatus ${pg.status}`);
      }
      const r = returnAsset(db, kdo, data, req.user.id);
      // Pengajuan pengembalian lain yang masih terbuka untuk kendaraan ini ikut selesai.
      const open = db.prepare("SELECT id FROM pengajuan WHERE jenis = 'pengembalian' AND kdo_id = ? AND status = 'disetujui'").all(kdo.id);
      for (const o of open) finish(db, o.id, req.user.id);
      return r;
    });
    log(req, 'PENGEMBALIAN', 'kdo', kdo.id, { pengembalian_id: hasil.id, berita_acara: hasil.ba.nomor, kondisi: data.kondisi_hasil_cek });
    send(res, { id: hasil.id, berita_acara_id: hasil.ba.id, berita_acara_nomor: hasil.ba.nomor }, { status: 201 });
  });

  app.get('/api/v1/berita-acara', (req, res) => {
    const where = new Where().eq('ba.jenis', req.query.jenis).eq('ba.kdo_id', req.query.kdo_id)
      .like(['ba.nomor', 'ba.pihak_pertama', 'ba.pihak_kedua', 'k.nomor_polisi'], req.query.q);
    if (req.user.role === 'pegawai') {
      const pns = db.prepare('SELECT nama_pegawai FROM pns WHERE id = ?').get(req.user.pns_id) ?? { nama_pegawai: '\u0000' };
      where.raw('(ba.pihak_pertama LIKE ? OR ba.pihak_kedua LIKE ?)', `${pns.nama_pegawai}%`, `${pns.nama_pegawai}%`);
    }
    const { rows, meta } = paginate(db, {
      select: 'ba.*, k.nomor_polisi, k.merek, k.tipe, pg.nomor AS pengajuan_nomor',
      from: 'berita_acara ba LEFT JOIN kdo k ON k.id = ba.kdo_id LEFT JOIN pengajuan pg ON pg.id = ba.pengajuan_id',
      where, query: req.query, orderBy: 'ba.tanggal DESC, ba.id DESC',
    });
    send(res, rows, { meta });
  });

  app.get('/api/v1/berita-acara/:id', (req, res) => {
    const ba = db.prepare(`SELECT ba.*, k.nomor_polisi, k.merek, k.tipe, k.nomor_rangka, k.nomor_mesin, k.tahun_produksi, k.kode_barang_aset,
      pg.nomor AS pengajuan_nomor FROM berita_acara ba LEFT JOIN kdo k ON k.id = ba.kdo_id LEFT JOIN pengajuan pg ON pg.id = ba.pengajuan_id
      WHERE ba.id = ?`).get(Number(req.params.id));
    if (!ba) throw notFound('Berita acara');
    if (req.user.role === 'pegawai') {
      const pns = db.prepare('SELECT nama_pegawai FROM pns WHERE id = ?').get(req.user.pns_id);
      if (!pns || ![ba.pihak_pertama, ba.pihak_kedua].some((p) => p.startsWith(pns.nama_pegawai))) throw forbidden('Berita acara ini bukan milik Anda');
    }
    send(res, { ...ba, jenis_label: labelOf(JENIS_BERITA_ACARA, ba.jenis) });
  });
}
