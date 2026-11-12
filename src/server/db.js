import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { initDatabase } from '../api/schema.js';
import { hashPassword } from './security.js';

/**
 * Membuka (dan bila perlu membuat + mengisi) database SQLite.
 * @param {string} file path database, atau ':memory:'
 * @param {{ sampleData?: boolean }} [options] isi data uji (pegawai, kendaraan) saat database baru dibuat
 */
export function openDatabase(file = ':memory:', { sampleData = true } = {}) {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  initDatabase(db, hashPassword, { sampleData });
  return db;
}
