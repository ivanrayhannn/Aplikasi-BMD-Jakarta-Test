// Klien REST API. Mode server: fetch ke /api/v1. Mode demo (GitHub Pages): API yang sama dijalankan di browser.
import config from '../config.js';

export const DEMO = config.mode === 'demo';
/** Database berisi data contoh fiktif: ditandai di UI agar tidak dikira data asli. */
export const SAMPLE = Boolean(config.sampleData);
const demo = DEMO ? await import('../demo-backend.js') : null;

/** Error dari API dengan kode, pesan, dan detail per field ({ field: pesan }). */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details ?? null;
  }
}

let token = null;
let onUnauthorized = () => {};

export function setToken(t) { token = t; }
export function onSessionExpired(fn) { onUnauthorized = fn; }

/** Susun query string, mengabaikan nilai kosong. */
export function qs(params = {}) {
  const s = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return s ? `?${s}` : '';
}

async function request(method, path, body) {
  const url = `/api/v1${path}`;
  const init = {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let res;
  try {
    res = DEMO ? await demo.demoFetch(url, init) : await fetch(url.slice(1), init); // relatif terhadap halaman
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server. Periksa koneksi Anda.');
  }
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = payload.error ?? {};
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    throw new ApiError(res.status, e.code ?? 'ERROR', e.message ?? 'Terjadi kesalahan', e.details);
  }
  return payload; // { data, meta }
}

export const api = {
  get: (path, params) => request('GET', path + qs(params)),
  post: (path, body = {}) => request('POST', path, body),
  put: (path, body = {}) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
};

/** Hapus seluruh data demo dan kembali ke data contoh (mode demo saja). */
export const resetDemo = () => demo?.resetDemo();
