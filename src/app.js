import express from 'express';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { KONDISI, STATUS, JENIS, transaction } from './db.js';
import { verifyPassword, newToken } from './auth.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SESSION_MS = 8 * 60 * 60 * 1000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const bad = (msg) => new HttpError(400, msg);

const today = () => new Date().toISOString().slice(0, 10);

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(ROOT, 'public')));
  app.get('/vendor/vue.js', (req, res) =>
    res.sendFile(join(ROOT, 'node_modules/vue/dist/vue.esm-browser.prod.js'))
  );

  const log = (req, aksi, entitas, entitasId, detail) =>
    db.prepare('INSERT INTO log_aktivitas (pengguna_id, aksi, entitas, entitas_id, detail) VALUES (?,?,?,?,?)')
      .run(req.user?.id ?? null, aksi, entitas, entitasId ?? null, detail ? JSON.stringify(detail) : null);

  // ---------- Autentikasi ----------
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body ?? {};
    const u = db.prepare('SELECT * FROM pengguna WHERE username = ?').get(String(username ?? ''));
    if (!u || !verifyPassword(String(password ?? ''), u.password_hash)) {
      throw new HttpError(401, 'Username atau kata sandi salah');
    }
    const token = newToken();
    db.prepare('INSERT INTO sesi (token, pengguna_id, kedaluwarsa) VALUES (?,?,?)').run(token, u.id, Date.now() + SESSION_MS);
    req.user = u;
    log(req, 'LOGIN', 'pengguna', u.id);
    res.json({ token, pengguna: publicUser(db, u) });
  });

  app.use('/api', (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer /, '');
    const row = db.prepare(
      'SELECT p.* FROM sesi s JOIN pengguna p ON p.id = s.pengguna_id WHERE s.token = ? AND s.kedaluwarsa > ?'
    ).get(token, Date.now());
    if (!row) throw new HttpError(401, 'Sesi tidak valid, silakan login kembali');
    req.user = row;
    req.token = token;
    next();
  });

  const isAdmin = (req) => req.user.peran === 'admin';
  const requireAdmin = (req) => {
    if (!isAdmin(req)) throw new HttpError(403, 'Hanya Administrator BPAD yang dapat melakukan aksi ini');
  };
  // Pengurus barang OPD hanya boleh mengakses data milik perangkat daerahnya.
  const assertScope = (req, pdId) => {
    if (!isAdmin(req) && Number(pdId) !== req.user.perangkat_daerah_id) {
      throw new HttpError(403, 'Data milik Perangkat Daerah lain');
    }
  };
  const scopeFilter = (req, column, where, params) => {
    if (!isAdmin(req)) {
      where.push(`${column} = ?`);
      params.push(req.user.perangkat_daerah_id);
    } else if (req.query.perangkat_daerah_id) {
      where.push(`${column} = ?`);
      params.push(Number(req.query.perangkat_daerah_id));
    }
  };

  app.post('/api/logout', (req, res) => {
    db.prepare('DELETE FROM sesi WHERE token = ?').run(req.token);
    res.json({ ok: true });
  });
  app.get('/api/me', (req, res) => res.json(publicUser(db, req.user)));
  app.get('/api/referensi', (req, res) => res.json({ kondisi: KONDISI, status: STATUS, jenis: JENIS }));

  // ---------- Perangkat Daerah ----------
  app.get('/api/perangkat-daerah', (req, res) => {
    const rows = isAdmin(req)
      ? db.prepare('SELECT * FROM perangkat_daerah ORDER BY nama').all()
      : db.prepare('SELECT * FROM perangkat_daerah WHERE id = ?').all(req.user.perangkat_daerah_id);
    res.json(rows);
  });
  app.post('/api/perangkat-daerah', (req, res) => {
    requireAdmin(req);
    const { kode, nama } = req.body ?? {};
    if (!kode?.trim() || !nama?.trim()) throw bad('Kode dan nama Perangkat Daerah wajib diisi');
    const id = insertUnique(() =>
      db.prepare('INSERT INTO perangkat_daerah (kode, nama) VALUES (?,?)').run(kode.trim(), nama.trim()).lastInsertRowid,
      'Kode Perangkat Daerah sudah terdaftar');
    log(req, 'TAMBAH', 'perangkat_daerah', id, { kode, nama });
    res.status(201).json(db.prepare('SELECT * FROM perangkat_daerah WHERE id = ?').get(id));
  });

  // ---------- Pegawai ----------
  app.get('/api/pegawai', (req, res) => {
    const where = [], params = [];
    scopeFilter(req, 'pg.perangkat_daerah_id', where, params);
    if (req.query.q) {
      where.push('(pg.nama LIKE ? OR pg.nip LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (req.query.aktif === '1') where.push('pg.aktif = 1');
    const rows = db.prepare(`
      SELECT pg.*, pd.nama AS perangkat_daerah,
        (SELECT COUNT(*) FROM penanggung_jawab pj WHERE pj.pegawai_id = pg.id AND pj.tanggal_selesai IS NULL) AS jumlah_kdo
      FROM pegawai pg JOIN perangkat_daerah pd ON pd.id = pg.perangkat_daerah_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY pg.nama`).all(...params);
    res.json(rows);
  });

  app.post('/api/pegawai', (req, res) => {
    const data = validatePegawai(req.body);
    if (!isAdmin(req)) data.perangkat_daerah_id = req.user.perangkat_daerah_id;
    const id = insertUnique(() => db.prepare(
      'INSERT INTO pegawai (nip, nama, jabatan, perangkat_daerah_id) VALUES (?,?,?,?)'
    ).run(data.nip, data.nama, data.jabatan, data.perangkat_daerah_id).lastInsertRowid, 'NIP sudah terdaftar');
    log(req, 'TAMBAH', 'pegawai', id, data);
    res.status(201).json(db.prepare('SELECT * FROM pegawai WHERE id = ?').get(id));
  });

  app.put('/api/pegawai/:id', (req, res) => {
    const existing = getOr404(db, 'pegawai', req.params.id);
    assertScope(req, existing.perangkat_daerah_id);
    const data = validatePegawai(req.body);
    if (!isAdmin(req)) data.perangkat_daerah_id = existing.perangkat_daerah_id;
    const aktif = req.body.aktif === undefined ? existing.aktif : (req.body.aktif ? 1 : 0);
    const holding = db.prepare('SELECT COUNT(*) AS n FROM penanggung_jawab WHERE pegawai_id = ? AND tanggal_selesai IS NULL').get(existing.id).n;
    if (holding && (!aktif || data.perangkat_daerah_id !== existing.perangkat_daerah_id)) {
      throw bad('Pegawai masih menjadi penanggung jawab KDO. Akhiri penugasan terlebih dahulu.');
    }
    insertUnique(() => db.prepare('UPDATE pegawai SET nip=?, nama=?, jabatan=?, perangkat_daerah_id=?, aktif=? WHERE id=?')
      .run(data.nip, data.nama, data.jabatan, data.perangkat_daerah_id, aktif, existing.id), 'NIP sudah terdaftar');
    log(req, 'UBAH', 'pegawai', existing.id, { ...data, aktif });
    res.json(db.prepare('SELECT * FROM pegawai WHERE id = ?').get(existing.id));
  });

  // ---------- Kendaraan ----------
  const KENDARAAN_SELECT = `
    SELECT k.*, pd.nama AS perangkat_daerah,
      pg.id AS pj_pegawai_id, pg.nama AS pj_nama, pg.nip AS pj_nip, pg.jabatan AS pj_jabatan,
      pj.nomor_bast AS pj_nomor_bast, pj.tanggal_mulai AS pj_tanggal_mulai
    FROM kendaraan k
    JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id
    LEFT JOIN penanggung_jawab pj ON pj.kendaraan_id = k.id AND pj.tanggal_selesai IS NULL
    LEFT JOIN pegawai pg ON pg.id = pj.pegawai_id`;

  const listKendaraan = (req) => {
    const where = [], params = [];
    scopeFilter(req, 'k.perangkat_daerah_id', where, params);
    for (const f of ['kondisi', 'status', 'jenis']) {
      if (req.query[f]) { where.push(`k.${f} = ?`); params.push(req.query[f]); }
    }
    if (req.query.q) {
      where.push('(k.nomor_polisi LIKE ? OR k.merk LIKE ? OR k.tipe LIKE ? OR pg.nama LIKE ?)');
      params.push(...Array(4).fill(`%${req.query.q}%`));
    }
    if (req.query.tanpa_pj === '1') where.push('pj.id IS NULL');
    return db.prepare(`${KENDARAAN_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY pd.nama, k.nomor_polisi`).all(...params);
  };

  app.get('/api/kendaraan', (req, res) => res.json(listKendaraan(req)));

  app.get('/api/kendaraan/:id', (req, res) => {
    const k = db.prepare(`${KENDARAAN_SELECT} WHERE k.id = ?`).get(Number(req.params.id));
    if (!k) throw new HttpError(404, 'Kendaraan tidak ditemukan');
    assertScope(req, k.perangkat_daerah_id);
    k.riwayat_penanggung_jawab = db.prepare(`
      SELECT pj.*, pg.nama, pg.nip, pg.jabatan FROM penanggung_jawab pj JOIN pegawai pg ON pg.id = pj.pegawai_id
      WHERE pj.kendaraan_id = ? ORDER BY pj.tanggal_mulai DESC, pj.id DESC`).all(k.id);
    k.riwayat_kondisi = db.prepare(`
      SELECT pk.*, u.nama AS pencatat FROM pemeriksaan_kondisi pk LEFT JOIN pengguna u ON u.id = pk.dicatat_oleh
      WHERE pk.kendaraan_id = ? ORDER BY pk.tanggal DESC, pk.id DESC`).all(k.id);
    res.json(k);
  });

  app.post('/api/kendaraan', (req, res) => {
    const data = validateKendaraan(req.body);
    if (!isAdmin(req)) data.perangkat_daerah_id = req.user.perangkat_daerah_id;
    getOr404(db, 'perangkat_daerah', data.perangkat_daerah_id);
    const cols = Object.keys(data);
    const id = insertUnique(() => db.prepare(
      `INSERT INTO kendaraan (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...cols.map((c) => data[c])).lastInsertRowid);
    db.prepare('INSERT INTO pemeriksaan_kondisi (kendaraan_id, tanggal, kondisi, catatan, dicatat_oleh) VALUES (?,?,?,?,?)')
      .run(id, today(), data.kondisi, 'Kondisi awal saat pendataan', req.user.id);
    log(req, 'TAMBAH', 'kendaraan', id, data);
    res.status(201).json(db.prepare('SELECT * FROM kendaraan WHERE id = ?').get(id));
  });

  app.put('/api/kendaraan/:id', (req, res) => {
    const existing = getOr404(db, 'kendaraan', req.params.id);
    assertScope(req, existing.perangkat_daerah_id);
    const data = validateKendaraan({ ...existing, ...req.body });
    // Kondisi hanya berubah melalui pemeriksaan agar riwayat tetap tercatat.
    data.kondisi = existing.kondisi;
    if (data.perangkat_daerah_id !== existing.perangkat_daerah_id) {
      requireAdmin(req);
      const pj = db.prepare('SELECT id FROM penanggung_jawab WHERE kendaraan_id = ? AND tanggal_selesai IS NULL').get(existing.id);
      if (pj) throw bad('Akhiri penanggung jawab aktif sebelum memindahkan kendaraan ke Perangkat Daerah lain');
    }
    if (data.status === 'Dihapus' && existing.status !== 'Dihapus') requireAdmin(req);
    if (data.status !== 'Aktif') {
      const pj = db.prepare('SELECT id FROM penanggung_jawab WHERE kendaraan_id = ? AND tanggal_selesai IS NULL').get(existing.id);
      if (pj) throw bad('Kendaraan masih memiliki penanggung jawab aktif. Akhiri penugasan terlebih dahulu.');
    }
    const cols = Object.keys(data);
    insertUnique(() => db.prepare(
      `UPDATE kendaraan SET ${cols.map((c) => `${c} = ?`).join(', ')}, diubah_pada = datetime('now') WHERE id = ?`
    ).run(...cols.map((c) => data[c]), existing.id));
    log(req, 'UBAH', 'kendaraan', existing.id, diff(existing, data));
    res.json(db.prepare('SELECT * FROM kendaraan WHERE id = ?').get(existing.id));
  });

  // ---------- Pemeriksaan kondisi ----------
  app.post('/api/kendaraan/:id/pemeriksaan', (req, res) => {
    const k = getOr404(db, 'kendaraan', req.params.id);
    assertScope(req, k.perangkat_daerah_id);
    if (k.status === 'Dihapus') throw bad('Kendaraan sudah dihapus dari daftar BMD');
    const { tanggal, kondisi, kilometer, catatan } = req.body ?? {};
    if (!DATE_RE.test(tanggal ?? '')) throw bad('Tanggal pemeriksaan wajib diisi (YYYY-MM-DD)');
    if (tanggal > today()) throw bad('Tanggal pemeriksaan tidak boleh melebihi hari ini');
    if (!KONDISI.includes(kondisi)) throw bad(`Kondisi harus salah satu dari: ${KONDISI.join(', ')}`);
    const km = optInt(kilometer, 'Kilometer');
    if (km !== null) {
      const last = db.prepare('SELECT MAX(kilometer) AS km FROM pemeriksaan_kondisi WHERE kendaraan_id = ? AND tanggal <= ?').get(k.id, tanggal).km;
      if (last !== null && km < last) throw bad(`Kilometer tidak boleh lebih kecil dari pemeriksaan sebelumnya (${last})`);
    }
    if (kondisi !== 'Baik' && !catatan?.trim()) throw bad('Catatan kerusakan wajib diisi untuk kondisi rusak');
    const id = transaction(db, () => {
      const id = db.prepare('INSERT INTO pemeriksaan_kondisi (kendaraan_id, tanggal, kondisi, kilometer, catatan, dicatat_oleh) VALUES (?,?,?,?,?,?)')
        .run(k.id, tanggal, kondisi, km, catatan?.trim() || null, req.user.id).lastInsertRowid;
      const latest = db.prepare('SELECT kondisi FROM pemeriksaan_kondisi WHERE kendaraan_id = ? ORDER BY tanggal DESC, id DESC LIMIT 1').get(k.id);
      db.prepare("UPDATE kendaraan SET kondisi = ?, diubah_pada = datetime('now') WHERE id = ?").run(latest.kondisi, k.id);
      return id;
    });
    log(req, 'PEMERIKSAAN', 'kendaraan', k.id, { tanggal, kondisi, kilometer: km });
    res.status(201).json(db.prepare('SELECT * FROM pemeriksaan_kondisi WHERE id = ?').get(id));
  });

  // ---------- Penanggung jawab ----------
  app.post('/api/kendaraan/:id/penanggung-jawab', (req, res) => {
    const k = getOr404(db, 'kendaraan', req.params.id);
    assertScope(req, k.perangkat_daerah_id);
    if (k.status !== 'Aktif') throw bad(`Kendaraan berstatus "${k.status}" tidak dapat ditetapkan penanggung jawab`);
    const { pegawai_id, nomor_bast, tanggal_mulai, keterangan } = req.body ?? {};
    const pg = getOr404(db, 'pegawai', pegawai_id);
    if (!pg.aktif) throw bad('Pegawai tidak aktif');
    if (pg.perangkat_daerah_id !== k.perangkat_daerah_id) throw bad('Pegawai harus berasal dari Perangkat Daerah pemilik kendaraan');
    if (!nomor_bast?.trim()) throw bad('Nomor BAST wajib diisi');
    if (!DATE_RE.test(tanggal_mulai ?? '')) throw bad('Tanggal mulai wajib diisi (YYYY-MM-DD)');
    const aktif = db.prepare('SELECT * FROM penanggung_jawab WHERE kendaraan_id = ? AND tanggal_selesai IS NULL').get(k.id);
    if (aktif?.pegawai_id === pg.id) throw bad('Pegawai tersebut sudah menjadi penanggung jawab kendaraan ini');
    if (aktif && tanggal_mulai < aktif.tanggal_mulai) throw bad('Tanggal mulai tidak boleh sebelum tanggal mulai penanggung jawab sebelumnya');
    const id = transaction(db, () => {
      if (aktif) db.prepare('UPDATE penanggung_jawab SET tanggal_selesai = ? WHERE id = ?').run(tanggal_mulai, aktif.id);
      return db.prepare('INSERT INTO penanggung_jawab (kendaraan_id, pegawai_id, nomor_bast, tanggal_mulai, keterangan, dicatat_oleh) VALUES (?,?,?,?,?,?)')
        .run(k.id, pg.id, nomor_bast.trim(), tanggal_mulai, keterangan?.trim() || null, req.user.id).lastInsertRowid;
    });
    log(req, 'TETAPKAN_PJ', 'kendaraan', k.id, { pegawai_id: pg.id, nomor_bast, tanggal_mulai, menggantikan: aktif?.pegawai_id });
    res.status(201).json(db.prepare('SELECT * FROM penanggung_jawab WHERE id = ?').get(id));
  });

  app.post('/api/kendaraan/:id/penanggung-jawab/akhiri', (req, res) => {
    const k = getOr404(db, 'kendaraan', req.params.id);
    assertScope(req, k.perangkat_daerah_id);
    const aktif = db.prepare('SELECT * FROM penanggung_jawab WHERE kendaraan_id = ? AND tanggal_selesai IS NULL').get(k.id);
    if (!aktif) throw bad('Kendaraan tidak memiliki penanggung jawab aktif');
    const { tanggal_selesai, keterangan } = req.body ?? {};
    if (!DATE_RE.test(tanggal_selesai ?? '')) throw bad('Tanggal selesai wajib diisi (YYYY-MM-DD)');
    if (tanggal_selesai < aktif.tanggal_mulai) throw bad('Tanggal selesai tidak boleh sebelum tanggal mulai');
    db.prepare('UPDATE penanggung_jawab SET tanggal_selesai = ?, keterangan = COALESCE(?, keterangan) WHERE id = ?')
      .run(tanggal_selesai, keterangan?.trim() || null, aktif.id);
    log(req, 'AKHIRI_PJ', 'kendaraan', k.id, { pegawai_id: aktif.pegawai_id, tanggal_selesai });
    res.json({ ok: true });
  });

  // ---------- Dashboard & laporan ----------
  app.get('/api/dashboard', (req, res) => {
    const where = ["k.status != 'Dihapus'"], params = [];
    scopeFilter(req, 'k.perangkat_daerah_id', where, params);
    const w = 'WHERE ' + where.join(' AND ');
    const q = (sql) => db.prepare(sql).all(...params);
    const batas = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    res.json({
      total: q(`SELECT COUNT(*) AS n FROM kendaraan k ${w}`)[0].n,
      per_kondisi: q(`SELECT kondisi, COUNT(*) AS jumlah FROM kendaraan k ${w} GROUP BY kondisi`),
      per_jenis: q(`SELECT jenis, COUNT(*) AS jumlah FROM kendaraan k ${w} GROUP BY jenis`),
      per_perangkat_daerah: q(`SELECT pd.nama, COUNT(*) AS jumlah,
          SUM(k.kondisi = 'Baik') AS baik, SUM(k.kondisi = 'Rusak Ringan') AS rusak_ringan, SUM(k.kondisi = 'Rusak Berat') AS rusak_berat
        FROM kendaraan k JOIN perangkat_daerah pd ON pd.id = k.perangkat_daerah_id ${w} GROUP BY pd.id ORDER BY pd.nama`),
      tanpa_penanggung_jawab: q(`SELECT COUNT(*) AS n FROM kendaraan k ${w} AND k.status = 'Aktif'
        AND NOT EXISTS (SELECT 1 FROM penanggung_jawab pj WHERE pj.kendaraan_id = k.id AND pj.tanggal_selesai IS NULL)`)[0].n,
      stnk_segera_habis: db.prepare(`SELECT k.id, k.nomor_polisi, k.merk, k.tipe, k.masa_berlaku_stnk FROM kendaraan k ${w}
        AND k.masa_berlaku_stnk IS NOT NULL AND k.masa_berlaku_stnk <= ? ORDER BY k.masa_berlaku_stnk`).all(...params, batas),
      belum_diperiksa_6_bulan: db.prepare(`SELECT COUNT(*) AS n FROM kendaraan k ${w} AND COALESCE(
        (SELECT MAX(tanggal) FROM pemeriksaan_kondisi pk WHERE pk.kendaraan_id = k.id), '0000') < date('now','-6 months')`).get(...params).n,
    });
  });

  app.get('/api/laporan/kendaraan.csv', (req, res) => {
    const rows = listKendaraan(req);
    const cols = [
      ['perangkat_daerah', 'Perangkat Daerah'], ['kode_barang', 'Kode Barang'], ['nomor_register', 'No. Register'],
      ['nomor_polisi', 'No. Polisi'], ['jenis', 'Jenis'], ['merk', 'Merk'], ['tipe', 'Tipe'],
      ['tahun_perolehan', 'Tahun Perolehan'], ['nilai_perolehan', 'Nilai Perolehan'], ['nomor_rangka', 'No. Rangka'],
      ['nomor_mesin', 'No. Mesin'], ['nomor_bpkb', 'No. BPKB'], ['masa_berlaku_stnk', 'Masa Berlaku STNK'],
      ['kondisi', 'Kondisi'], ['status', 'Status'], ['pj_nama', 'Penanggung Jawab'], ['pj_nip', 'NIP'],
      ['pj_jabatan', 'Jabatan'], ['pj_nomor_bast', 'No. BAST'],
    ];
    const esc = (v) => {
      const s = v == null ? '' : String(v);
      // Cegah CSV/formula injection saat dibuka di spreadsheet.
      const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      return /[",;\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
    };
    const csv = [cols.map((c) => c[1]).join(';'), ...rows.map((r) => cols.map((c) => esc(r[c[0]])).join(';'))].join('\r\n');
    log(req, 'EKSPOR', 'laporan', null, { jumlah: rows.length });
    res.type('text/csv; charset=utf-8')
      .attachment(`laporan-kdo-${today()}.csv`)
      .send('﻿' + csv);
  });

  app.get('/api/log-aktivitas', (req, res) => {
    requireAdmin(req);
    res.json(db.prepare(`SELECT l.*, u.nama AS pengguna FROM log_aktivitas l LEFT JOIN pengguna u ON u.id = l.pengguna_id
      ORDER BY l.id DESC LIMIT 200`).all());
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint tidak ditemukan' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status ?? (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Terjadi kesalahan pada server' : err.message });
  });

  return app;
}

// ---------- Helper ----------
function publicUser(db, u) {
  const pd = u.perangkat_daerah_id ? db.prepare('SELECT nama FROM perangkat_daerah WHERE id = ?').get(u.perangkat_daerah_id) : null;
  return { id: u.id, username: u.username, nama: u.nama, peran: u.peran, perangkat_daerah_id: u.perangkat_daerah_id, perangkat_daerah: pd?.nama ?? null };
}

const TABLES = new Set(['kendaraan', 'pegawai', 'perangkat_daerah']);
function getOr404(db, table, id) {
  if (!TABLES.has(table)) throw new Error('tabel tidak dikenal');
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
  if (!row) throw new HttpError(404, `Data ${table.replace('_', ' ')} tidak ditemukan`);
  return row;
}

function insertUnique(fn, message) {
  try {
    return fn();
  } catch (err) {
    if (/UNIQUE constraint failed/.test(err.message)) {
      if (message) throw bad(message);
      const field = {
        'kendaraan.nomor_polisi': 'Nomor polisi', 'kendaraan.nomor_rangka': 'Nomor rangka',
        'kendaraan.nomor_mesin': 'Nomor mesin', 'kendaraan.perangkat_daerah_id': 'Kombinasi kode barang dan nomor register pada Perangkat Daerah ini',
      };
      const key = Object.keys(field).find((f) => err.message.includes(f));
      throw bad(`${field[key] ?? 'Data'} sudah terdaftar`);
    }
    throw err;
  }
}

function optInt(v, label) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw bad(`${label} harus berupa bilangan bulat positif`);
  return n;
}

function validatePegawai(body = {}) {
  const nip = String(body.nip ?? '').replace(/\s/g, '');
  if (!/^\d{18}$/.test(nip)) throw bad('NIP harus 18 digit angka');
  if (!body.nama?.trim()) throw bad('Nama pegawai wajib diisi');
  if (!body.jabatan?.trim()) throw bad('Jabatan wajib diisi');
  return { nip, nama: body.nama.trim(), jabatan: body.jabatan.trim(), perangkat_daerah_id: Number(body.perangkat_daerah_id) || null };
}

function validateKendaraan(b = {}) {
  const req = (k, label) => {
    const v = typeof b[k] === 'string' ? b[k].trim() : b[k];
    if (v === undefined || v === null || v === '') throw bad(`${label} wajib diisi`);
    return v;
  };
  const opt = (k) => (typeof b[k] === 'string' ? b[k].trim() : b[k]) || null;
  const nopol = String(req('nomor_polisi', 'Nomor polisi')).toUpperCase().replace(/\s+/g, ' ');
  if (!/^[A-Z]{1,2} \d{1,4}( [A-Z]{1,3})?$/.test(nopol)) throw bad('Format nomor polisi tidak valid (contoh: B 1234 PQR)');
  const jenis = req('jenis', 'Jenis kendaraan');
  if (!JENIS.includes(jenis)) throw bad(`Jenis harus salah satu dari: ${JENIS.join(', ')}`);
  const tahun = Number(req('tahun_perolehan', 'Tahun perolehan'));
  if (!Number.isInteger(tahun) || tahun < 1950 || tahun > new Date().getFullYear()) throw bad('Tahun perolehan tidak valid');
  const kondisi = b.kondisi ?? 'Baik';
  if (!KONDISI.includes(kondisi)) throw bad(`Kondisi harus salah satu dari: ${KONDISI.join(', ')}`);
  const status = b.status ?? 'Aktif';
  if (!STATUS.includes(status)) throw bad(`Status harus salah satu dari: ${STATUS.join(', ')}`);
  const stnk = opt('masa_berlaku_stnk');
  if (stnk && !DATE_RE.test(stnk)) throw bad('Masa berlaku STNK harus berformat YYYY-MM-DD');
  return {
    perangkat_daerah_id: Number(b.perangkat_daerah_id) || null,
    kode_barang: req('kode_barang', 'Kode barang'),
    nomor_register: req('nomor_register', 'Nomor register'),
    nomor_polisi: nopol,
    jenis,
    merk: req('merk', 'Merk'),
    tipe: opt('tipe'),
    tahun_perolehan: tahun,
    nilai_perolehan: optInt(b.nilai_perolehan, 'Nilai perolehan') ?? 0,
    nomor_rangka: String(req('nomor_rangka', 'Nomor rangka')).toUpperCase(),
    nomor_mesin: String(req('nomor_mesin', 'Nomor mesin')).toUpperCase(),
    nomor_bpkb: opt('nomor_bpkb'),
    warna: opt('warna'),
    isi_silinder: optInt(b.isi_silinder, 'Isi silinder'),
    bahan_bakar: opt('bahan_bakar'),
    masa_berlaku_stnk: stnk,
    kondisi,
    status,
    keterangan: opt('keterangan'),
  };
}

function diff(before, after) {
  const out = {};
  for (const k of Object.keys(after)) if (before[k] !== after[k]) out[k] = [before[k], after[k]];
  return out;
}
