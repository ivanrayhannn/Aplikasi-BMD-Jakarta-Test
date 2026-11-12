// Router berbasis hash (#/kdo/12), cocok untuk hosting statis (GitHub Pages) maupun server.
import { reactive } from '../vendor/vue.js';

const routes = [];

/**
 * Daftarkan rute. Pola mendukung parameter, mis. '/kdo/:id/ubah'.
 * @param {string} pattern
 * @param {object} component
 * @param {{ admin?: boolean, section?: string }} [meta]
 */
export function defineRoute(pattern, component, meta = {}) {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  routes.push({ pattern, re, keys, component, meta });
}

export const route = reactive({ path: '/', params: {}, query: {}, match: null });

function resolve() {
  const [path, search = ''] = (location.hash.slice(1) || '/dashboard').split('?');
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      Object.assign(route, {
        path,
        params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])),
        query: Object.fromEntries(new URLSearchParams(search)),
        match: r,
      });
      return;
    }
  }
  navigate('/dashboard');
}

export function navigate(path) {
  if (location.hash.slice(1) === path) resolve();
  else location.hash = path;
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
