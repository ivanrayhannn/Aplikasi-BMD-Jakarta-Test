// Konvensi HTTP API (PRD §5 "Catatan Arsitektur"):
//   sukses → { data, meta? }
//   gagal  → { error: { code, message, details? } }
// Seluruh modul melempar ApiError; error handler di api/index.js yang mengubahnya menjadi respons.
import { DATE_RE } from '../shared/validation.js';

export class ApiError extends Error {
  /**
   * @param {number} status kode status HTTP
   * @param {string} code kode error mesin (VALIDATION_ERROR, CONFLICT, ...)
   * @param {string} message pesan untuk pengguna
   * @param {Record<string, any>} [details] mis. pesan per field
   */
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new ApiError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Sesi tidak valid, silakan masuk kembali') => new ApiError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Anda tidak memiliki hak untuk melakukan tindakan ini') => new ApiError(403, 'FORBIDDEN', message);
export const notFound = (what = 'Data') => new ApiError(404, 'NOT_FOUND', `${what} tidak ditemukan`);
export const conflict = (message, details) => new ApiError(409, 'CONFLICT', message, details);
export const invalid = (details, message = 'Data yang dikirim belum valid') =>
  new ApiError(422, 'VALIDATION_ERROR', message, details);

/** Kirim respons sukses berformat { data, meta }. */
export function send(res, data, { meta, status = 200 } = {}) {
  res.status(status).json(meta ? { data, meta } : { data });
}

// Paginasi & penyaringan
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 1000; // cukup untuk mengisi dropdown pilihan

export function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const perPage = Math.min(MAX_PER_PAGE, Math.max(1, Number.parseInt(query.per_page, 10) || DEFAULT_PER_PAGE));
  return { page, perPage, offset: (page - 1) * perPage };
}

/**
 * Penyusun klausa WHERE sederhana dengan parameter terikat (tanpa interpolasi nilai).
 * @example const w = new Where().eq('k.kondisi', q.kondisi).like(['k.merek'], q.q); w.sql; w.params
 */
export class Where {
  #parts = [];
  params = [];

  /** Tambah `column = ?` bila nilai tidak kosong. */
  eq(column, value) {
    if (value !== undefined && value !== null && value !== '') {
      this.#parts.push(`${column} = ?`);
      this.params.push(value);
    }
    return this;
  }

  /** Tambah pencarian LIKE (OR antar kolom) bila kata kunci tidak kosong. */
  like(columns, keyword) {
    const kw = typeof keyword === 'string' ? keyword.trim() : '';
    if (kw) {
      this.#parts.push(`(${columns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
      this.params.push(...columns.map(() => `%${kw}%`));
    }
    return this;
  }

  /** Tambah potongan SQL apa adanya beserta parameternya. */
  raw(sql, ...params) {
    this.#parts.push(sql);
    this.params.push(...params);
    return this;
  }

  get sql() {
    return this.#parts.length ? `WHERE ${this.#parts.join(' AND ')}` : '';
  }
}

/**
 * Menjalankan query daftar berpaginasi.
 * @param {*} db
 * @param {{ select: string, from: string, where: Where, orderBy: string, query: Record<string, any> }} spec
 */
export function paginate(db, { select, from, where, orderBy, query }) {
  const { page, perPage, offset } = pagination(query);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${from} ${where.sql}`).get(...where.params);
  const rows = db
    .prepare(`SELECT ${select} FROM ${from} ${where.sql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
    .all(...where.params, perPage, offset);
  return { rows, meta: { page, per_page: perPage, total, total_pages: Math.max(1, Math.ceil(total / perPage)) } };
}

/** Nilai filter boolean dari query string ('1'/'0'/'true'/'false'); undefined bila kosong. */
export function boolParam(v) {
  if (v === undefined || v === '') return undefined;
  return v === '1' || v === 'true' ? 1 : 0;
}

/** Validasi rentang tanggal filter laporan. */
export function dateRange(query) {
  const { dari, sampai } = query;
  const details = {};
  if (dari && !DATE_RE.test(dari)) details.dari = 'Tanggal awal harus berformat YYYY-MM-DD';
  if (sampai && !DATE_RE.test(sampai)) details.sampai = 'Tanggal akhir harus berformat YYYY-MM-DD';
  if (!Object.keys(details).length && dari && sampai && dari > sampai) details.sampai = 'Tanggal akhir tidak boleh sebelum tanggal awal';
  if (Object.keys(details).length) throw invalid(details, 'Filter periode tidak valid');
  return { dari: dari || null, sampai: sampai || null };
}
