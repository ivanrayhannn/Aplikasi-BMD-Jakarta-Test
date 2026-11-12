import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/server/db.js';
import { hasSampleData } from '../src/api/schema.js';

test('tanpa data contoh: hanya data wajib PRD (PD-001 s.d. PD-003 + admin)', () => {
  const db = openDatabase(':memory:', { sampleData: false });
  assert.deepEqual(db.prepare('SELECT kode FROM perangkat_daerah ORDER BY kode').all().map((r) => r.kode), ['PD-001', 'PD-002', 'PD-003']);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM kdo').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM pns').get().n, 0);
  assert.deepEqual(db.prepare('SELECT email, role FROM users').all().map((u) => ({ ...u })), [{ email: 'admin@kdo.test', role: 'admin' }]);
  assert.equal(hasSampleData(db), false);
});

test('dengan data contoh: ditandai sebagai data contoh', () => {
  assert.equal(hasSampleData(openDatabase(':memory:')), true);
});
