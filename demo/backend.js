// Backend mode demo (GitHub Pages): menjalankan REST API yang sama dengan server (src/api)
// di dalam browser, memakai SQLite WebAssembly (sql.js). Data disimpan di localStorage
// browser masing-masing pengunjung.
import { registerApi } from './lib/api/index.js';
import { initDatabase } from './lib/api/schema.js';

const STORAGE_KEY = 'si-kdo-demo-db-v2';
try { localStorage.removeItem('si-kdo-demo-db-v1'); } catch { /* data demo skema lama */ }

// Autentikasi demo
// Hash sinkron sederhana (FNV-1a, 4 putaran bergaram). Cukup untuk demo lokal karena
// seluruh data memang berada di browser pengguna; server produksi memakai scrypt.
function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
const digest = (pw, salt) => [0, 1, 2, 3].map((i) => fnv(`${i}:${salt}:${pw}`)).join('');
const randomHex = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const security = {
  hashPassword: (pw) => { const salt = randomHex(8); return `${salt}:${digest(pw, salt)}`; },
  verifyPassword: (pw, stored) => { const [salt, h] = stored.split(':'); return digest(pw, salt) === h; },
  newToken: () => randomHex(32),
};

// Adaptor sql.js -> API mirip node:sqlite
function wrapDatabase(sql) {
  const norm = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));
  return {
    exec: (s) => sql.exec(s),
    prepare(s) {
      return {
        run(...p) {
          sql.run(s, norm(p));
          const id = sql.exec('SELECT last_insert_rowid()')[0].values[0][0];
          return { lastInsertRowid: id, changes: sql.getRowsModified() };
        },
        get(...p) {
          const st = sql.prepare(s);
          try { st.bind(norm(p)); return st.step() ? st.getAsObject() : undefined; } finally { st.free(); }
        },
        all(...p) {
          const st = sql.prepare(s), rows = [];
          try { st.bind(norm(p)); while (st.step()) rows.push(st.getAsObject()); return rows; } finally { st.free(); }
        },
      };
    },
  };
}

// Router mini bergaya Express
class MiniApp {
  constructor() { this.stack = []; }
  #add(method, path, fn) {
    if (typeof path === 'function') { fn = path; path = ''; }
    const keys = [];
    const re = method === 'USE'
      ? new RegExp('^' + path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      : new RegExp('^' + path.replace(/\./g, '\\.').replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '$');
    this.stack.push({ method, re, keys, fn });
  }
  get(p, fn) { this.#add('GET', p, fn); return this; }
  post(p, fn) { this.#add('POST', p, fn); return this; }
  put(p, fn) { this.#add('PUT', p, fn); return this; }
  delete(p, fn) { this.#add('DELETE', p, fn); return this; }
  use(p, fn) { this.#add('USE', p, fn); return this; }

  handle({ method, url, headers, body }) {
    const u = new URL(url, 'http://demo');
    const req = {
      method, path: u.pathname, originalUrl: u.pathname + u.search, params: {}, body,
      query: Object.fromEntries(u.searchParams),
      get: (h) => headers[h.toLowerCase()],
    };
    const out = { status: 200, headers: {}, body: '' };
    const res = {
      status(s) { out.status = s; return res; },
      json(o) { out.headers['content-type'] = 'application/json'; out.body = JSON.stringify(o); return res; },
      type(t) { out.headers['content-type'] = t; return res; },
      attachment(name) { out.headers['content-disposition'] = `attachment; filename="${name}"`; return res; },
      send(s) { out.body = s; return res; },
    };
    let error = null;
    for (const layer of this.stack) {
      const isErrorHandler = layer.fn.length === 4;
      if (error ? !isErrorHandler : isErrorHandler) continue;
      if (layer.method !== 'USE' && layer.method !== method) continue;
      const m = req.path.match(layer.re);
      if (!m) continue;
      layer.keys.forEach((k, i) => (req.params[k] = decodeURIComponent(m[i + 1])));
      let calledNext = false;
      try {
        if (isErrorHandler) layer.fn(error, req, res, () => {});
        else layer.fn(req, res, () => (calledNext = true));
        if (isErrorHandler) return out;
      } catch (e) { error = e; continue; }
      if (!calledNext) return out;
    }
    return out;
  }
}

// Inisialisasi
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = Object.assign(document.createElement('script'), { src, onload: resolve, onerror: reject });
    document.head.append(s);
  });
}

let ready;
async function boot() {
  await loadScript('./vendor/sql-wasm.js');
  const SQL = await window.initSqlJs({ locateFile: (f) => './vendor/' + f });
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage tidak tersedia */ }
  const sql = saved ? new SQL.Database(Uint8Array.from(atob(saved), (c) => c.charCodeAt(0))) : new SQL.Database();
  const db = wrapDatabase(sql);
  initDatabase(db, security.hashPassword);
  const app = new MiniApp();
  registerApi(app, db, security);
  const persist = () => {
    try {
      const bytes = sql.export();
      sql.exec('PRAGMA foreign_keys = ON;'); // export() mereset pragma
      let bin = '';
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      localStorage.setItem(STORAGE_KEY, btoa(bin));
    } catch { /* abaikan: data tetap ada selama tab terbuka */ }
  };
  if (!saved) persist();
  return { app, persist };
}

/** Pengganti fetch() untuk path /api/..., mengembalikan objek Response standar. */
export async function demoFetch(url, { method = 'GET', headers = {}, body } = {}) {
  ready ??= boot();
  const { app, persist } = await ready;
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  let parsed;
  try { parsed = body ? JSON.parse(body) : undefined; } catch { parsed = undefined; }
  const out = app.handle({ method, url, headers: lower, body: parsed });
  if (method !== 'GET') persist();
  return new Response(out.body, { status: out.status, headers: out.headers });
}

/** Mengembalikan data demo ke kondisi awal. */
export function resetDemo() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* abaikan */ }
}
