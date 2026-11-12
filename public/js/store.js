// State global aplikasi: sesi pengguna, pengaturan instansi, dan notifikasi.
import { reactive, computed } from '../vendor/vue.js';
import { api, setToken, onSessionExpired } from './api.js';

const TOKEN_KEY = 'kdo_token';
const readToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
const writeToken = (t) => { try { t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage diblokir */ } };

export const store = reactive({
  user: null,
  settings: null,
  toast: null,
  ready: false,
});

export const isAdmin = computed(() => store.user?.role === 'admin');

let toastTimer;
/** Tampilkan notifikasi singkat. */
export function notify(message, type = 'success') {
  store.toast = { message, type };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (store.toast = null), 3500);
}

function clearSession() {
  setToken(null);
  writeToken(null);
  store.user = null;
}

onSessionExpired(() => {
  if (store.user) notify('Sesi berakhir, silakan masuk kembali', 'error');
  clearSession();
});

export async function loadSettings() {
  store.settings = (await api.get('/pengaturan')).data;
}

/** Pulihkan sesi dari sessionStorage saat aplikasi dibuka. */
export async function restoreSession() {
  const t = readToken();
  if (t) {
    setToken(t);
    try {
      store.user = (await api.get('/auth/me')).data;
      await loadSettings();
    } catch {
      clearSession();
    }
  }
  store.ready = true;
}

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  setToken(data.token);
  writeToken(data.token);
  store.user = data.user;
  await loadSettings();
}

export async function logout() {
  try { await api.post('/auth/logout'); } catch { /* sesi mungkin sudah berakhir */ }
  clearSession();
}
