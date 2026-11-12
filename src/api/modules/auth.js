// Fitur 06 (Masuk Akun): login email + kata sandi, keluar, profil pengguna aktif.
import { send, invalid, unauthorized } from '../http.js';
import { schemas, validate } from '../../shared/validation.js';
import { ENUMS } from '../../shared/enums.js';

const SESSION_MS = 8 * 60 * 60 * 1000;

/** Bentuk data pengguna yang aman dikirim ke klien (tanpa password_hash). */
export function publicUser(db, u) {
  const pns = u.pns_id ? db.prepare('SELECT nama_pegawai, nip FROM pns WHERE id = ?').get(u.pns_id) : null;
  return {
    id: u.id, nama: u.nama, email: u.email, role: u.role, is_active: u.is_active,
    pns_id: u.pns_id, pns_nama: pns?.nama_pegawai ?? null, created_at: u.created_at,
  };
}

export function registerPublic(app, { db, security, log }) {
  app.post('/api/v1/auth/login', (req, res) => {
    const { data, errors } = validate(schemas.login, req.body);
    if (errors) throw invalid(errors);
    const user = db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(data.email);
    // Pesan disamakan agar tidak membocorkan apakah email terdaftar.
    if (!user || !security.verifyPassword(data.password, user.password_hash)) {
      throw unauthorized('Email atau kata sandi salah');
    }
    if (!user.is_active) throw unauthorized('Akun Anda dinonaktifkan. Hubungi administrator.');
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token = security.newToken();
    db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?,?,?)').run(token, user.id, Date.now() + SESSION_MS);
    req.user = user;
    log(req, 'LOGIN', 'users', user.id);
    send(res, { token, expires_in: SESSION_MS / 1000, user: publicUser(db, user) });
  });
}

export function register(app, { db, log }) {
  app.post('/api/v1/auth/logout', (req, res) => {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(req.token);
    log(req, 'LOGOUT', 'users', req.user.id);
    send(res, { ok: true });
  });

  app.get('/api/v1/auth/me', (req, res) => send(res, publicUser(db, req.user)));

  // Pilihan terkendali untuk dropdown form (fitur 07).
  app.get('/api/v1/referensi', (req, res) => send(res, ENUMS));
}
