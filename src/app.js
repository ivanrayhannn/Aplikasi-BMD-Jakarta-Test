import express from 'express';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { registerApi } from './api.js';
import { verifyPassword, newToken } from './auth.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function createApp(db) {
  const app = express();
  app.use(express.json());
  app.use(express.static(join(ROOT, 'public')));
  app.get('/vendor/vue.js', (req, res) =>
    res.sendFile(join(ROOT, 'node_modules/vue/dist/vue.esm-browser.prod.js'))
  );
  return registerApi(app, db, { verifyPassword, newToken });
}
