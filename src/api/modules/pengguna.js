// Fitur 06 (Kelola Pengguna, khusus admin): daftar, tambah, ubah, nonaktifkan.
// Pengguna tidak dihapus fisik; menonaktifkan akun langsung mengakhiri seluruh sesinya.
import { send, invalid, conflict, forbidden, paginate, Where } from '../http.js';
import { findOr404, assertUnique, insert, update, diff } from '../db.js';
import { schemas, validate } from '../../shared/validation.js';
import { publicUser } from './auth.js';

const ENTITY = 'Pengguna';

function parse(db, body, { creating }) {
  const { data, errors } = validate(schemas.pengguna, body);
  const all = { ...(errors ?? {}) };
  if (creating && !data.password && !all.password) all.password = 'Kata sandi awal wajib diisi';
  if (data.pns_id && !db.prepare('SELECT id FROM pns WHERE id = ?').get(data.pns_id)) all.pns_id = 'Pegawai tidak ditemukan';
  if (Object.keys(all).length) throw invalid(all);
  return data;
}

export function register(app, { db, security, log }) {
  const adminOnly = (req) => {
    if (req.user.role !== 'admin') throw forbidden('Hanya Pengelola Aset (admin) yang dapat mengelola pengguna');
  };

  app.get('/api/v1/pengguna', (req, res) => {
    adminOnly(req);
    const where = new Where().like(['u.nama', 'u.email'], req.query.q).eq('u.role', req.query.role);
    const { rows, meta } = paginate(db, { select: 'u.*', from: 'users u', where, orderBy: 'u.nama', query: req.query });
    send(res, rows.map((u) => publicUser(db, u)), { meta });
  });

  app.get('/api/v1/pengguna/:id', (req, res) => {
    adminOnly(req);
    send(res, publicUser(db, findOr404(db, 'users', req.params.id, ENTITY)));
  });

  app.post('/api/v1/pengguna', (req, res) => {
    const data = parse(db, req.body, { creating: true });
    assertUnique(db, 'users', schemas.pengguna, data, ['email']);
    const { password, ...rest } = data;
    const id = insert(db, 'users', { ...rest, password_hash: security.hashPassword(password) });
    log(req, 'TAMBAH', 'users', id, rest);
    send(res, publicUser(db, findOr404(db, 'users', id)), { status: 201 });
  });

  app.put('/api/v1/pengguna/:id', (req, res) => {
    const current = findOr404(db, 'users', req.params.id, ENTITY);
    const data = parse(db, { ...current, password: undefined, ...req.body }, { creating: false });
    assertUnique(db, 'users', schemas.pengguna, data, ['email'], current.id);

    const isSelf = current.id === req.user.id;
    if (isSelf && (!data.is_active || data.role !== 'admin')) {
      throw conflict('Anda tidak dapat menonaktifkan atau menurunkan peran akun Anda sendiri');
    }
    const losesAdmin = current.role === 'admin' && current.is_active && (data.role !== 'admin' || !data.is_active);
    if (losesAdmin) {
      const { n } = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1 AND id <> ?").get(current.id);
      if (!n) throw conflict('Harus ada minimal satu admin aktif');
    }

    const { password, ...rest } = data;
    update(db, 'users', current.id, password ? { ...rest, password_hash: security.hashPassword(password) } : rest);
    // Cabut sesi lain saat akun dinonaktifkan atau sandinya diganti; sesi admin yang sedang dipakai tetap berlaku.
    if (!data.is_active || password) {
      db.prepare('DELETE FROM sessions WHERE user_id = ? AND id IS NOT ?').run(current.id, isSelf ? req.token : null);
    }
    log(req, 'UBAH', 'users', current.id, { ...diff(current, rest), ...(password ? { password: 'diubah' } : {}) });
    send(res, publicUser(db, findOr404(db, 'users', current.id)));
  });

  app.get('/api/v1/log-aktivitas', (req, res) => {
    adminOnly(req);
    const where = new Where().eq('l.entitas', req.query.entitas).eq('l.aksi', req.query.aksi);
    const { rows, meta } = paginate(db, {
      select: 'l.*, u.nama AS pengguna', from: 'log_aktivitas l LEFT JOIN users u ON u.id = l.user_id',
      where, orderBy: 'l.id DESC', query: { per_page: 50, ...req.query },
    });
    send(res, rows, { meta });
  });
}
