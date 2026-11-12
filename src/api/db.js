// Helper akses data yang dipakai seluruh modul API.
import { invalid, notFound } from './http.js';
import { fieldLabel } from '../shared/validation.js';

/** Menjalankan fn di dalam transaksi; rollback bila fn melempar error. */
export function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const TABLES = new Set(['perangkat_daerah', 'pns', 'kdo', 'kdo_pemakaian', 'kdo_perawatan', 'users']);

/** Ambil satu baris berdasarkan id atau lempar 404. */
export function findOr404(db, table, id, label) {
  if (!TABLES.has(table)) throw new Error(`Tabel tidak dikenal: ${table}`);
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(Number(id));
  if (!row) throw notFound(label);
  return row;
}

/**
 * Pastikan nilai field unik belum dipakai baris lain → 422 dengan nama field (PRD fitur 08).
 * Dicek di API agar pesan ramah; constraint UNIQUE di DB tetap menjadi pengaman terakhir.
 */
export function assertUnique(db, table, schema, data, fields, exceptId = null) {
  if (!TABLES.has(table)) throw new Error(`Tabel tidak dikenal: ${table}`);
  const details = {};
  for (const field of fields) {
    if (data[field] === null || data[field] === undefined) continue;
    const row = db
      .prepare(`SELECT id FROM ${table} WHERE ${field} = ? COLLATE NOCASE AND id IS NOT ?`)
      .get(data[field], exceptId);
    if (row) details[field] = `${fieldLabel(schema, field)} "${data[field]}" sudah terdaftar`;
  }
  if (Object.keys(details).length) throw invalid(details);
}

/** INSERT dari objek kolom → nilai; mengembalikan id baru. */
export function insert(db, table, data) {
  const cols = Object.keys(data);
  return Number(
    db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`)
      .run(...cols.map((c) => data[c])).lastInsertRowid
  );
}

/** UPDATE kolom-kolom pada satu baris; menyentuh updated_at bila tabel memilikinya. */
export function update(db, table, id, data, { touch = true } = {}) {
  const cols = Object.keys(data);
  if (!cols.length) return;
  const set = cols.map((c) => `${c} = ?`);
  if (touch) set.push("updated_at = datetime('now')");
  db.prepare(`UPDATE ${table} SET ${set.join(', ')} WHERE id = ?`).run(...cols.map((c) => data[c]), id);
}

/** Selisih nilai sebelum/sesudah untuk jejak audit. */
export function diff(before, after) {
  const out = {};
  for (const k of Object.keys(after)) if (before[k] !== after[k]) out[k] = [before[k], after[k]];
  return out;
}
