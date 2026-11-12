// Fitur 07 (Pengaturan Aplikasi): data instansi (kop laporan), pengingat, pilihan terkendali.
import { send, invalid } from '../http.js';
import { diff } from '../db.js';
import { schemas, validate } from '../../shared/validation.js';
import { ENUMS } from '../../shared/enums.js';

export function getSettings(db) {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

export function register(app, { db, log }) {
  // Dapat dibaca semua pengguna yang sudah masuk (kop laporan & pengingat dashboard).
  app.get('/api/v1/pengaturan', (req, res) => send(res, { ...getSettings(db), pilihan: ENUMS }));

  app.put('/api/v1/pengaturan', (req, res) => {
    const current = getSettings(db);
    const body = { ...current, ...req.body };
    const { data, errors } = validate(schemas.pengaturan, body);
    if (errors) throw invalid(errors);
    db.prepare(`UPDATE settings SET nama_instansi = ?, alamat = ?, logo_url = ?, pengingat_servis_hari = ?,
      pengingat_pembaruan_hari = ?, updated_at = datetime('now') WHERE id = 1`)
      .run(data.nama_instansi, data.alamat, data.logo_url, data.pengingat_servis_hari, data.pengingat_pembaruan_hari);
    const changes = diff(current, data);
    if (changes.logo_url) changes.logo_url = ['(logo lama)', data.logo_url ? '(logo baru)' : null];
    log(req, 'UBAH', 'settings', 1, changes);
    send(res, { ...getSettings(db), pilihan: ENUMS });
  });
}
