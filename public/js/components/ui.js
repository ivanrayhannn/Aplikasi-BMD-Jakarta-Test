// Komponen UI bersama dan composable form.
import { reactive, ref } from '../../vendor/vue.js';
import { validate } from '../../lib/shared/validation.js';
import { ApiError } from '../api.js';
import { notify } from '../store.js';
import { ENUMS } from '../format.js';

export const Badge = {
  props: { tone: { type: String, default: 'muted' } },
  template: `<span class="badge" :class="tone"><slot /></span>`,
};

/** Penanda sedang memuat; diumumkan pembaca layar lewat role="status". */
export const LoadingState = {
  props: { text: { type: String, default: 'Memuat data…' } },
  template: `<p class="loading-state" role="status">{{ text }}</p>`,
};

export const EmptyState = {
  props: { title: String, hint: String },
  template: `<div class="empty"><b>{{ title }}</b><p v-if="hint">{{ hint }}</p><slot /></div>`,
};

export const PageHeader = {
  props: { title: String, subtitle: String, back: String, backLabel: String },
  template: `<div class="page-head">
    <div>
      <a v-if="back" :href="back" class="back">← {{ backLabel || 'Kembali' }}</a>
      <h1>{{ title }}<slot name="badges" /></h1>
      <p v-if="subtitle">{{ subtitle }}</p>
    </div>
    <div class="actions"><slot /></div>
  </div>`,
};

let dialogCount = 0;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Kotak dialog modal: fokus tertahan di dalam dialog, Esc menutup, fokus kembali ke tombol pembuka. */
export const Modal = {
  props: { title: String, wide: Boolean },
  emits: ['close'],
  data: () => ({ titleId: `dlg-${++dialogCount}` }),
  mounted() {
    this.opener = document.activeElement;
    this.$el.querySelector('input:not([disabled]), select, textarea, button')?.focus();
  },
  unmounted() { this.opener?.focus?.(); },
  methods: {
    trap(e) {
      const items = [...this.$el.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const [first, last] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    },
  },
  template: `<div class="modal-backdrop" @mousedown.self="$emit('close')" @keydown.esc="$emit('close')" @keydown.tab="trap">
    <div class="modal" :class="{ wide }" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <h2 :id="titleId">{{ title }}</h2><slot />
    </div></div>`,
};

/**
 * Dialog konfirmasi. `action` dijalankan saat dikonfirmasi; error API (mis. 409) ditampilkan di dalam dialog.
 */
export const ConfirmDialog = {
  components: { Modal },
  props: { title: String, confirmLabel: { type: String, default: 'Hapus' }, action: Function, danger: { type: Boolean, default: true } },
  emits: ['close', 'done'],
  setup(props, { emit }) {
    const busy = ref(false);
    const error = ref('');
    async function confirm() {
      busy.value = true;
      error.value = '';
      try {
        const result = await props.action();
        emit('done', result);
      } catch (e) {
        error.value = e.message;
      } finally {
        busy.value = false;
      }
    }
    return { busy, error, confirm };
  },
  template: `<Modal :title="title" @close="$emit('close')">
    <div class="confirm-body"><slot /></div>
    <div v-if="error" class="alert error" role="alert">{{ error }}</div>
    <footer>
      <button type="button" @click="$emit('close')">{{ error ? 'Tutup' : 'Batal' }}</button>
      <button v-if="!error" type="button" :class="danger ? 'danger-solid' : 'primary'" :disabled="busy" @click="confirm">
        {{ busy ? 'Memproses…' : confirmLabel }}</button>
    </footer>
  </Modal>`,
};

/** Pembungkus field form: label, penanda wajib, petunjuk, dan pesan error. */
export const Field = {
  props: { label: String, name: String, error: String, required: Boolean, hint: String, full: Boolean },
  template: `<div class="field" :class="{ full, invalid: !!error }">
    <label :for="name">{{ label }} <span v-if="required" class="req" aria-hidden="true">*</span></label>
    <slot />
    <div v-if="error" class="field-error" :id="name + '-error'">{{ error }}</div>
    <div v-else-if="hint" class="hint">{{ hint }}</div>
  </div>`,
};

/** Dropdown dari pilihan terkendali (ENUM). */
export const EnumSelect = {
  props: { group: String, modelValue: [String, null], placeholder: String, id: String },
  emits: ['update:modelValue'],
  setup() { return { ENUMS }; },
  template: `<select :id="id" :value="modelValue ?? ''" @change="$emit('update:modelValue', $event.target.value || null)">
    <option value="">{{ placeholder || 'Pilih' }}</option>
    <option v-for="o in ENUMS[group]" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>`,
};

export const Pager = {
  props: { meta: Object },
  emits: ['page'],
  template: `<div v-if="meta && meta.total_pages > 1" class="pager">
    <span>{{ (meta.page - 1) * meta.per_page + 1 }}–{{ Math.min(meta.page * meta.per_page, meta.total) }} dari {{ meta.total }}</span>
    <button class="small" :disabled="meta.page <= 1" @click="$emit('page', meta.page - 1)">‹ Sebelumnya</button>
    <button class="small" :disabled="meta.page >= meta.total_pages" @click="$emit('page', meta.page + 1)">Berikutnya ›</button>
  </div>`,
};

/**
 * Composable form: nilai, error per field (validasi klien dengan skema yang sama dengan server),
 * dan pemetaan error API (422 details) ke field.
 * @param {Record<string, any>} schema skema dari shared/validation.js
 * @param {Record<string, any>} initial nilai awal
 */
export function useForm(schema, initial = {}) {
  const values = reactive({ ...initial });
  const errors = reactive({});
  const state = reactive({ busy: false, message: '' });

  const clear = () => { for (const k of Object.keys(errors)) delete errors[k]; state.message = ''; };

  /**
   * Validasi lalu jalankan `fn(values)`. Mengembalikan hasil fn, atau undefined bila gagal.
   * @param {(values: object) => Promise<any>} fn
   * @param {{ success?: string, validateFields?: string[] }} [opts]
   */
  async function submit(fn, { success, validateFields } = {}) {
    clear();
    const { errors: clientErrors } = validate(schema, values, { only: validateFields });
    if (clientErrors) {
      Object.assign(errors, clientErrors);
      state.message = 'Periksa kembali isian yang ditandai.';
      return undefined;
    }
    state.busy = true;
    try {
      const result = await fn(values);
      if (success) notify(success);
      return result;
    } catch (e) {
      if (e instanceof ApiError && e.details && e.status === 422) Object.assign(errors, e.details);
      state.message = e.message;
      return undefined;
    } finally {
      state.busy = false;
    }
  }

  return { values, errors, state, submit, clear };
}
