// Helper pengujian: menjalankan server dengan database in-memory baru per berkas uji.
import { before, after } from 'node:test';
import { openDatabase } from '../src/server/db.js';
import { createApp } from '../src/server/app.js';

export const ADMIN = { email: 'admin@kdo.test', password: 'admin12345' };
export const PETUGAS = { email: 'petugas@kdo.test', password: 'petugas12345' };

/** Mendaftarkan hook before/after dan mengembalikan klien API. */
export function useServer() {
  const ctx = { base: '', server: null, db: null };
  before(async () => {
    ctx.db = openDatabase(':memory:');
    ctx.server = createApp(ctx.db).listen(0);
    await new Promise((r) => ctx.server.once('listening', r));
    ctx.base = `http://localhost:${ctx.server.address().port}/api/v1`;
  });
  after(() => ctx.server.close());

  const api = async (method, path, { token, body } = {}) => {
    const res = await fetch(ctx.base + path, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };
  const login = async (cred = ADMIN) => (await api('POST', '/auth/login', { body: cred })).body.data.token;
  return { ctx, api, login };
}

export const kdoBaru = (over = {}) => ({
  nomor_polisi: 'b 9999 tst', merek: 'Toyota', tipe: 'Avanza', tahun_produksi: 2023, jenis_kendaraan: 'roda_4',
  kondisi: 'baik', nomor_rangka: 'rangka-uji-1', nomor_mesin: 'mesin-uji-1', perangkat_daerah_id: 1,
  nilai_perolehan: 250000000, ...over,
});
