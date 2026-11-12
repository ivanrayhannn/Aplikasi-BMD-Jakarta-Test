// Aplikasi Express: menyajikan frontend (public/), modul bersama (src/shared), vendor, dan REST API.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registerApi } from '../api/index.js';
import { hasSampleData } from '../api/schema.js';
import * as security from './security.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Berkas pihak ketiga yang dipakai frontend, disajikan dari node_modules (tanpa CDN). */
export const VENDOR = {
  'vue.js': 'node_modules/vue/dist/vue.esm-browser.prod.js',
  'exceljs.min.js': 'node_modules/exceljs/dist/exceljs.min.js',
  'jspdf.umd.min.js': 'node_modules/jspdf/dist/jspdf.umd.min.js',
  'jspdf.plugin.autotable.min.js': 'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  'sql-wasm.js': 'node_modules/sql.js/dist/sql-wasm.js',
  'sql-wasm.wasm': 'node_modules/sql.js/dist/sql-wasm.wasm',
};

export function createApp(db) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' })); // cukup untuk logo instansi (maks. 300 KB)
  // Menggantikan public/config.js: memberi tahu UI bila database berisi data uji.
  app.get('/config.js', (req, res) => {
    res.type('text/javascript').send(`export default ${JSON.stringify({ mode: 'server', sampleData: hasSampleData(db) })};\n`);
  });
  app.use(express.static(join(ROOT, 'public')));
  app.use('/lib/shared', express.static(join(ROOT, 'src/shared')));
  app.use('/db', express.static(join(ROOT, 'db/mysql'))); // unduhan DDL di menu Rancangan Database
  app.get('/vendor/:file', (req, res, next) => {
    const path = VENDOR[req.params.file];
    if (!path) return next();
    res.sendFile(join(ROOT, path));
  });
  return registerApi(app, db, security);
}
