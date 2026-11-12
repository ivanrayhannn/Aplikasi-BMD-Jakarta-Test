// Fitur 05 (Laporan & Cetak): pratinjau dengan kop instansi, filter langsung, cetak, unduh PDF/Excel.
import { ref, reactive, computed, watch, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { notify } from '../store.js';
import { route } from '../router.js';
import { label, tanggal, rupiah, today, kendaraan } from '../format.js';
import { fetchOptions } from '../components/list.js';
import { PageHeader, EnumSelect, EmptyState } from '../components/ui.js';
import { exportPdf, exportExcel } from '../exporters.js';

const periode = (p) => (p?.dari || p?.sampai ? `${p.dari ? tanggal(p.dari) : 'awal'} s.d. ${p.sampai ? tanggal(p.sampai) : 'sekarang'}` : 'Semua periode');

/** Definisi tiap jenis laporan: endpoint, filter, dan cara menyusun kolom/baris/ringkasan. */
const REPORTS = {
  kendaraan: {
    title: 'Laporan Daftar Kendaraan Dinas',
    endpoint: '/laporan/kendaraan',
    filters: { perangkat_daerah_id: '', kondisi: '', jenis_kendaraan: '' },
    build: (rows, meta) => ({
      columns: [{ label: 'No', align: 'right' }, { label: 'No. Polisi' }, { label: 'Merek / Tipe' }, { label: 'Jenis' },
        { label: 'Tahun', align: 'center' }, { label: 'Kondisi' }, { label: 'Unit Pemilik' }, { label: 'Pemegang' }],
      rows: rows.map((r, i) => [String(i + 1), r.nomor_polisi, kendaraan(r), label('jenis_kendaraan', r.jenis_kendaraan),
        String(r.tahun_produksi), label('kondisi', r.kondisi), r.perangkat_daerah, r.pemegang_nama ?? '-']),
      summary: [
        ...meta.ringkasan.per_kondisi.map((k) => [`Kondisi ${label('kondisi', k.kondisi)}`, `${k.jumlah} unit`]),
        ['Total kendaraan', `${meta.ringkasan.total} unit`],
      ],
    }),
  },
  pemakaian: {
    title: 'Laporan Pemakaian Kendaraan',
    endpoint: '/laporan/pemakaian',
    filters: { dari: '', sampai: '', perangkat_daerah_id: '' },
    build: (rows, meta) => ({
      periode: periode(meta.periode),
      columns: [{ label: 'No', align: 'right' }, { label: 'No. Polisi' }, { label: 'Pemakai' }, { label: 'NIP' }, { label: 'Unit' },
        { label: 'Mulai' }, { label: 'Selesai' }, { label: 'Status' }],
      rows: rows.map((r, i) => [String(i + 1), r.nomor_polisi, r.pns_nama, r.pns_nip, r.perangkat_daerah, tanggal(r.tanggal_mulai),
        r.tanggal_selesai ? tanggal(r.tanggal_selesai) : 'Masih berjalan', label('status_pemakaian', r.status)]),
      summary: [['Pemakaian aktif', String(meta.ringkasan.aktif)], ['Pemakaian selesai', String(meta.ringkasan.selesai)], ['Total', String(meta.ringkasan.total)]],
    }),
  },
  perawatan: {
    title: 'Laporan Perawatan Kendaraan',
    endpoint: '/laporan/perawatan',
    filters: { kdo_id: '', dari: '', sampai: '' },
    build: (rows, meta) => ({
      periode: periode(meta.periode),
      columns: [{ label: 'No', align: 'right' }, { label: 'Tanggal' }, { label: 'Kendaraan' }, { label: 'Jenis' }, { label: 'Bengkel' },
        { label: 'Biaya', align: 'right' }, { label: 'Kondisi Setelah' }, { label: 'Jadwal Berikutnya' }],
      rows: rows.map((r, i) => [String(i + 1), tanggal(r.tanggal_servis), `${r.nomor_polisi} (${kendaraan(r)})`,
        label('jenis_perawatan', r.jenis_perawatan), r.bengkel ?? '-', rupiah(r.biaya), label('kondisi', r.kondisi_setelah),
        r.jadwal_berikutnya ? tanggal(r.jadwal_berikutnya) : '-']),
      summary: [
        ...meta.ringkasan.per_kendaraan.map((k) => [`Total ${k.nomor_polisi} (${k.jumlah} servis)`, rupiah(k.total_biaya)]),
        ['Total biaya keseluruhan', rupiah(meta.ringkasan.total_biaya)],
      ],
    }),
  },
};

export const LaporanPage = {
  components: { PageHeader, EnumSelect, EmptyState },
  setup() {
    const type = ref(REPORTS[route.query.jenis] ? route.query.jenis : 'kendaraan');
    const filters = reactive({ ...REPORTS[type.value].filters });
    const result = ref(null);
    const error = ref('');
    const loading = ref(false);
    const exporting = ref('');
    const units = ref([]);
    const vehicles = ref([]);

    async function load() {
      loading.value = true;
      error.value = '';
      const requested = type.value;
      try {
        const { data, meta } = await api.get(REPORTS[requested].endpoint, filters);
        // Abaikan respons usang bila pengguna sudah berpindah jenis laporan.
        if (requested === type.value) result.value = { type: requested, data, meta };
      } catch (e) { error.value = e.message; result.value = null; } finally { loading.value = false; }
    }

    const report = computed(() => {
      // Susun dari jenis laporan milik data itu sendiri, bukan tab yang sedang dipilih.
      if (!result.value) return null;
      const { type: kind, meta, data } = result.value;
      const def = REPORTS[kind];
      return {
        title: def.title, kop: meta.kop, dicetakPada: tanggal(meta.dicetak_pada), periode: '',
        filename: `laporan-${kind}-${meta.dicetak_pada}`, empty: !data.length, ...def.build(data, meta),
      };
    });

    function selectType(t) {
      type.value = t;
      for (const k of Object.keys(filters)) delete filters[k];
      Object.assign(filters, REPORTS[t].filters);
      history.replaceState(null, '', `#/laporan?jenis=${t}`);
    }

    let timer;
    watch(filters, () => { clearTimeout(timer); timer = setTimeout(load, 250); });
    onMounted(async () => {
      load();
      [units.value, vehicles.value] = await Promise.all([fetchOptions('/perangkat-daerah'), fetchOptions('/kdo')]);
    });

    async function run(kind) {
      exporting.value = kind;
      try {
        if (kind === 'pdf') await exportPdf(report.value);
        else if (kind === 'excel') await exportExcel(report.value);
        else window.print();
      } catch (e) { notify(`Gagal membuat berkas: ${e.message}`, 'error'); } finally { exporting.value = ''; }
    }

    return { type, filters, report, error, loading, exporting, units, vehicles, selectType, run, REPORTS, today };
  },
  template: `<div>
    <PageHeader title="Laporan & Cetak" subtitle="Rekap siap cetak dengan kop instansi" class="no-print" />
    <div class="card no-print">
      <div class="tabs" role="tablist">
        <button v-for="(def, key) in REPORTS" :key="key" role="tab" :aria-selected="type === key" :class="{ active: type === key }" @click="selectType(key)">
          {{ def.title.replace('Laporan ', '') }}</button>
      </div>
      <div class="filters">
        <template v-if="type !== 'perawatan'">
          <label class="filter"><span>Unit</span><select v-model="filters.perangkat_daerah_id"><option value="">Semua unit</option>
            <option v-for="u in units" :key="u.id" :value="String(u.id)">{{ u.nama_dinas }}</option></select></label>
        </template>
        <template v-if="type === 'kendaraan'">
          <label class="filter"><span>Kondisi</span><EnumSelect v-model="filters.kondisi" group="kondisi" placeholder="Semua kondisi" /></label>
          <label class="filter"><span>Jenis kendaraan</span><EnumSelect v-model="filters.jenis_kendaraan" group="jenis_kendaraan" placeholder="Semua jenis" /></label>
        </template>
        <template v-if="type === 'perawatan'">
          <label class="filter"><span>Kendaraan</span><select v-model="filters.kdo_id"><option value="">Semua kendaraan</option>
            <option v-for="k in vehicles" :key="k.id" :value="String(k.id)">{{ k.nomor_polisi }} · {{ k.merek }} {{ k.tipe }}</option></select></label>
        </template>
        <template v-if="type !== 'kendaraan'">
          <label class="filter"><span>Dari tanggal</span><input type="date" v-model="filters.dari" :max="filters.sampai || undefined"></label>
          <label class="filter"><span>Sampai tanggal</span><input type="date" v-model="filters.sampai" :min="filters.dari || undefined"></label>
        </template>
        <span class="grow"></span>
        <button @click="run('print')" :disabled="!report || report.empty">Cetak</button>
        <button @click="run('pdf')" :disabled="!report || report.empty || !!exporting">{{ exporting === 'pdf' ? 'Membuat PDF…' : 'Unduh PDF' }}</button>
        <button class="primary" @click="run('excel')" :disabled="!report || report.empty || !!exporting">{{ exporting === 'excel' ? 'Membuat Excel…' : 'Unduh Excel' }}</button>
      </div>
    </div>
    <div v-if="error" class="alert error no-print">{{ error }}</div>

    <LoadingState v-if="!report && loading" text="Menyusun laporan…" />
    <article v-if="report" class="report-sheet" :class="{ loading }">
      <header class="kop">
        <img v-if="report.kop.logo_url" :src="report.kop.logo_url" alt="Logo instansi">
        <div><b>{{ report.kop.nama_instansi }}</b><span>{{ report.kop.alamat }}</span></div>
      </header>
      <h2 class="report-title">{{ report.title }}</h2>
      <p class="report-meta"><span v-if="report.periode">Periode: {{ report.periode }} · </span>Tanggal cetak: {{ report.dicetakPada }}</p>
      <EmptyState v-if="report.empty" title="Tidak ada data untuk filter ini" hint="Ubah filter atau periode laporan. Tombol cetak & unduh dinonaktifkan saat laporan kosong." />
      <template v-else>
        <div class="table-wrap"><table class="report-table stack">
          <thead><tr><th v-for="c in report.columns" :key="c.label" :class="{ num: c.align === 'right' }">{{ c.label }}</th></tr></thead>
          <tbody><tr v-for="(r, i) in report.rows" :key="i"><td v-for="(v, j) in r" :key="j" :data-label="report.columns[j].label" :class="{ num: report.columns[j].align === 'right' }">{{ v }}</td></tr></tbody>
        </table></div>
        <table class="report-summary"><tbody><tr v-for="[k, v] in report.summary" :key="k"><th>{{ k }}</th><td>{{ v }}</td></tr></tbody></table>
        <div class="signature"><p>Jakarta, {{ report.dicetakPada }}</p><p>Pengelola Aset</p><p class="sign-space"></p><p>(...................................)</p></div>
      </template>
    </article>
  </div>`,
};
