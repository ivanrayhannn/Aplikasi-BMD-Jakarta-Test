// Titik masuk REST API /api/v1 (PRD §5).
// Modul ini tidak bergantung pada Node.js/Express: `app` cukup menyediakan get/post/put/delete/use
// bergaya Express. Kode yang sama dipakai server Express (src/server) dan mode demo di browser (demo/).
import { ApiError, unauthorized, forbidden } from './http.js';
import * as auth from './modules/auth.js';
import * as perangkatDaerah from './modules/perangkat-daerah.js';
import * as pns from './modules/pns.js';
import * as kdo from './modules/kdo.js';
import * as pemakaian from './modules/pemakaian.js';
import * as perawatan from './modules/perawatan.js';
import * as dashboard from './modules/dashboard.js';
import * as laporan from './modules/laporan.js';
import * as pengguna from './modules/pengguna.js';
import * as pengaturan from './modules/pengaturan.js';

export const BASE = '/api/v1';

/**
 * @param app       objek bergaya Express
 * @param db        koneksi SQLite (prepare().run/get/all, exec)
 * @param security  { verifyPassword(pw, hash), hashPassword(pw), newToken() }
 */
export function registerApi(app, db, security) {
  const ctx = {
    db,
    security,
    /** Catat jejak audit. */
    log(req, aksi, entitas, entitasId, detail) {
      db.prepare('INSERT INTO log_aktivitas (user_id, aksi, entitas, entitas_id, detail) VALUES (?,?,?,?,?)')
        .run(req.user?.id ?? null, aksi, entitas, entitasId ?? null, detail ? JSON.stringify(detail) : null);
    },
  };

  // Rute publik (sebelum middleware autentikasi).
  auth.registerPublic(app, ctx);

  // Autentikasi: semua rute /api/v1 lain wajib sesi valid (fitur 06).
  app.use(BASE, (req, res, next) => {
    const token = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const user = token && db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > ? AND u.is_active = 1`).get(token, Date.now());
    if (!user) throw unauthorized();
    req.user = user;
    req.token = token;
    next();
  });

  // Otorisasi: petugas lapangan hanya dapat melihat data (fitur 06 "Peran & Izin").
  app.use(BASE, (req, res, next) => {
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    const selfService = req.originalUrl.split('?')[0] === `${BASE}/auth/logout`;
    if (isWrite && !selfService && req.user.role !== 'admin') {
      throw forbidden('Peran Petugas Lapangan hanya dapat melihat data');
    }
    next();
  });

  for (const mod of [auth, dashboard, perangkatDaerah, pns, kdo, pemakaian, perawatan, laporan, pengguna, pengaturan]) {
    mod.register(app, ctx);
  }

  app.use(BASE, () => {
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint tidak ditemukan');
  });

  // Penanganan error seragam: { error: { code, message, details } }.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Body JSON tidak valid' } });
    }
    if (/UNIQUE constraint failed/.test(err?.message)) {
      return res.status(422).json({ error: { code: 'VALIDATION_ERROR', message: 'Data sudah terdaftar' } });
    }
    if (/FOREIGN KEY constraint failed/.test(err?.message)) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'Data masih direferensikan data lain' } });
    }
    console.error(err);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Terjadi kesalahan pada server' } });
  });

  return app;
}
