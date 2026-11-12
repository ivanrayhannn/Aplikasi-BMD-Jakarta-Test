// Composable daftar data: filter reaktif (tersinkron ke URL), paginasi, dan pemuatan dengan debounce.
import { reactive, ref, watch, onMounted } from '../../vendor/vue.js';
import { api, qs } from '../api.js';
import { route } from '../router.js';

/**
 * @param {string} path endpoint API, mis. '/kdo'
 * @param {Record<string, string>} defaults nilai awal filter
 */
export function useList(path, defaults = {}) {
  const filters = reactive({ ...defaults, ...pick(route.query, Object.keys(defaults)) });
  const page = ref(Number(route.query.page) || 1);
  const rows = ref([]);
  const meta = ref(null);
  const loading = ref(false);
  const error = ref('');

  async function load() {
    loading.value = true;
    error.value = '';
    try {
      const res = await api.get(path, { ...filters, page: page.value });
      rows.value = res.data;
      meta.value = res.meta;
    } catch (e) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }

  // Simpan filter di URL agar tombol kembali & tautan mempertahankan hasil saringan.
  function syncUrl() {
    const [base, search = ''] = location.hash.slice(1).split('?');
    // Pertahankan parameter lain di URL (mis. ?tab=) yang tidak dikelola daftar ini.
    const others = Object.fromEntries([...new URLSearchParams(search)].filter(([k]) => !(k in defaults) && k !== 'page'));
    const next = base + qs({ ...others, ...filters, page: page.value > 1 ? page.value : '' });
    if (location.hash.slice(1) !== next) history.replaceState(null, '', '#' + next);
  }

  let timer;
  watch(filters, () => {
    clearTimeout(timer);
    timer = setTimeout(() => { page.value = 1; syncUrl(); load(); }, 250);
  });
  const goTo = (p) => { page.value = p; syncUrl(); load(); };
  const reset = () => Object.assign(filters, Object.fromEntries(Object.keys(defaults).map((k) => [k, defaults[k]])));
  const hasFilter = () => Object.entries(filters).some(([k, v]) => v !== defaults[k]);

  onMounted(load);
  return { filters, rows, meta, loading, error, load, goTo, reset, hasFilter };
}

/** Ambil semua baris (untuk dropdown pilihan). */
export async function fetchOptions(path, params = {}) {
  return (await api.get(path, { per_page: 1000, ...params })).data;
}

function pick(obj, keys) {
  return Object.fromEntries(keys.filter((k) => obj[k] !== undefined).map((k) => [k, obj[k]]));
}
