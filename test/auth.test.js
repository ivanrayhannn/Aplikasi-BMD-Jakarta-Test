import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useServer, ADMIN, PETUGAS } from './helpers.js';

const { api, login } = useServer();

test('login salah ditolak 401 dengan pesan jelas', async () => {
  const r = await api('POST', '/auth/login', { body: { email: ADMIN.email, password: 'salah' } });
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, 'UNAUTHORIZED');
  assert.equal(r.body.error.message, 'Email atau kata sandi salah');
});

test('endpoint data wajib login', async () => {
  const r = await api('GET', '/kdo');
  assert.equal(r.status, 401);
});

test('login berhasil mengembalikan token & profil tanpa password_hash', async () => {
  const r = await api('POST', '/auth/login', { body: ADMIN });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.user.role, 'admin');
  assert.equal(r.body.data.user.password_hash, undefined);
  const me = await api('GET', '/auth/me', { token: r.body.data.token });
  assert.equal(me.body.data.email, ADMIN.email);
});

test('petugas lapangan hanya dapat melihat (403 saat mengubah)', async () => {
  const token = await login(PETUGAS);
  assert.equal((await api('GET', '/kdo', { token })).status, 200);
  const r = await api('POST', '/perangkat-daerah', { token, body: { kode: 'X', nama_dinas: 'X' } });
  assert.equal(r.status, 403);
  assert.equal(r.body.error.code, 'FORBIDDEN');
  assert.equal((await api('GET', '/pengguna', { token })).status, 403);
});

test('logout mengakhiri sesi', async () => {
  const token = await login();
  assert.equal((await api('POST', '/auth/logout', { token })).status, 200);
  assert.equal((await api('GET', '/auth/me', { token })).status, 401);
});

test('kelola pengguna: email unik, nonaktif tidak bisa masuk, tidak bisa menonaktifkan diri sendiri', async () => {
  const token = await login();
  const baru = { nama: 'Uji', email: 'uji@kdo.test', role: 'petugas', password: 'rahasia123' };
  const created = await api('POST', '/pengguna', { token, body: baru });
  assert.equal(created.status, 201);

  const dup = await api('POST', '/pengguna', { token, body: { ...baru, email: 'UJI@kdo.test' } });
  assert.equal(dup.status, 422);
  assert.match(dup.body.error.details.email, /sudah terdaftar/);

  const userToken = await login({ email: baru.email, password: baru.password });
  await api('PUT', `/pengguna/${created.body.data.id}`, { token, body: { is_active: false } });
  assert.equal((await api('GET', '/auth/me', { token: userToken })).status, 401, 'sesi lama dicabut');
  const relog = await api('POST', '/auth/login', { body: { email: baru.email, password: baru.password } });
  assert.equal(relog.status, 401);
  assert.match(relog.body.error.message, /dinonaktifkan/);

  const self = await api('PUT', '/pengguna/1', { token, body: { is_active: false } });
  assert.equal(self.status, 409);
});
