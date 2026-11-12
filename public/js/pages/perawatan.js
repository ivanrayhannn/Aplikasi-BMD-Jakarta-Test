// Fitur 04 (Riwayat Perawatan): jadwal (kendaraan perlu servis), rekap biaya per kendaraan, dan semua catatan.
import { ref, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { isAdmin } from '../store.js';
import { route } from '../router.js';
import { label, tone, tanggal, rupiah, kendaraan, STATUS_JADWAL_LABEL } from '../format.js';
import { useList } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, EnumSelect } from '../components/ui.js';
import { PerawatanDialog } from '../components/dialogs.js';

const TABS = [['jadwal', 'Jadwal Servis'], ['rekap', 'Rekap Biaya'], ['catatan', 'Semua Catatan']];

const JadwalTab = {
  components: { Badge, EmptyState },
  setup() {
    const rows = ref([]);
    const meta = ref(null);
    const loading = ref(true);
    const error = ref('');
    onMounted(async () => {
      try { ({ data: rows.value, meta: meta.value } = await api.get('/perawatan/jadwal')); } catch (e) { error.value = e.message; } finally { loading.value = false; }
    });
    return { rows, meta, loading, error, tone, tanggal, label, kendaraan, STATUS_JADWAL_LABEL };
  },
  template: `<div>
    <p class="hint" v-if="meta">Diurutkan dari jadwal paling dekat. "Segera servis" = jadwal ≤ {{ meta.pengingat_servis_hari }} hari lagi.</p>
    <div class="table-wrap"><table class="stack">
      <thead><tr><th>Kendaraan</th><th>Unit</th><th>Servis terakhir</th><th>Jadwal berikutnya</th><th>Status</th><th>Kondisi</th></tr></thead>
      <tbody><tr v-for="r in rows" :key="r.kdo_id">
        <td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a><span class="sub">{{ kendaraan(r) }}</span></td>
        <td data-label="Unit">{{ r.perangkat_daerah }}</td><td data-label="Servis terakhir">{{ tanggal(r.servis_terakhir) }}</td><td data-label="Jadwal berikutnya">{{ tanggal(r.jadwal_berikutnya) }}</td>
        <td data-label="Status"><Badge :tone="tone('status_jadwal', r.status_jadwal)">{{ STATUS_JADWAL_LABEL[r.status_jadwal] }}</Badge>
          <span class="sub">{{ r.sisa_hari < 0 ? 'lewat ' + (-r.sisa_hari) + ' hari' : r.sisa_hari + ' hari lagi' }}</span></td>
        <td data-label="Kondisi"><Badge :tone="tone('kondisi', r.kondisi)">{{ label('kondisi', r.kondisi) }}</Badge></td></tr></tbody>
    </table></div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-else-if="loading" />
    <EmptyState v-else-if="!rows.length" title="Belum ada jadwal servis" hint="Isi 'Jadwal servis berikutnya' saat mencatat perawatan." />
  </div>`,
};

const RekapTab = {
  components: { EmptyState },
  setup() {
    const rows = ref([]);
    const total = ref(0);
    const loading = ref(true);
    const error = ref('');
    onMounted(async () => {
      try { const r = await api.get('/perawatan/rekap'); rows.value = r.data; total.value = r.meta.total_biaya; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    });
    return { rows, total, loading, error, rupiah, tanggal, kendaraan };
  },
  template: `<div>
    <div class="table-wrap"><table class="stack">
      <thead><tr><th>Kendaraan</th><th>Unit</th><th class="num">Jumlah servis</th><th>Servis terakhir</th><th class="num">Total biaya</th></tr></thead>
      <tbody><tr v-for="r in rows" :key="r.kdo_id">
        <td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a><span class="sub">{{ kendaraan(r) }}</span></td>
        <td data-label="Unit">{{ r.perangkat_daerah }}</td><td data-label="Jumlah servis" class="num">{{ r.jumlah_servis }}</td><td data-label="Servis terakhir">{{ tanggal(r.servis_terakhir) }}</td>
        <td data-label="Total biaya" class="num"><b>{{ rupiah(r.total_biaya) }}</b></td></tr></tbody>
      <tfoot v-if="rows.length"><tr><th colspan="4">Total seluruh kendaraan</th><th class="num">{{ rupiah(total) }}</th></tr></tfoot>
    </table></div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-else-if="loading" />
    <EmptyState v-else-if="!rows.length" title="Belum ada biaya perawatan" hint="Biaya muncul setelah perawatan pertama dicatat." />
  </div>`,
};

const CatatanTab = {
  components: { Badge, EmptyState, Pager, EnumSelect, PerawatanDialog },
  setup() {
    const list = useList('/perawatan', { q: '', jenis_perawatan: '' });
    const editing = ref(null);
    const done = () => { editing.value = null; list.load(); };
    return { ...list, editing, done, isAdmin, label, tone, tanggal, rupiah };
  },
  template: `<div>
    <div class="filters">
      <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor polisi, bengkel, atau deskripsi…"></label>
      <label class="filter"><span>Jenis perawatan</span><EnumSelect v-model="filters.jenis_perawatan" group="jenis_perawatan" placeholder="Semua jenis" /></label>
      <button v-if="isAdmin" class="primary" @click="editing = {}">+ Catat Perawatan</button>
    </div>
    <p class="hint" v-if="meta?.ringkasan">{{ meta.ringkasan.jumlah }} catatan, total {{ rupiah(meta.ringkasan.total_biaya) }}</p>
    <div class="table-wrap"><table class="stack">
      <thead><tr><th>Tanggal</th><th>Kendaraan</th><th>Jenis</th><th>Bengkel</th><th class="num">Biaya</th><th>Kondisi setelah</th><th>Jadwal berikutnya</th></tr></thead>
      <tbody><tr v-for="r in rows" :key="r.id">
        <td data-label="Tanggal">{{ tanggal(r.tanggal_servis) }}</td><td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a></td>
        <td data-label="Jenis">{{ label('jenis_perawatan', r.jenis_perawatan) }}<span class="sub">{{ r.deskripsi }}</span></td><td data-label="Bengkel">{{ r.bengkel || '-' }}</td>
        <td data-label="Biaya" class="num">{{ rupiah(r.biaya) }}</td><td data-label="Kondisi setelah"><Badge :tone="tone('kondisi', r.kondisi_setelah)">{{ label('kondisi', r.kondisi_setelah) }}</Badge></td>
        <td data-label="Jadwal berikutnya">{{ tanggal(r.jadwal_berikutnya) }}</td></tr></tbody>
    </table></div>
    <LoadingState v-if="loading && !rows.length" />
    <EmptyState v-if="!rows.length && !loading" title="Belum ada catatan perawatan" />
    <Pager :meta="meta" @page="goTo" />
    <PerawatanDialog v-if="editing" :record="editing" @close="editing = null" @saved="done" />
  </div>`,
};

export const PerawatanPage = {
  components: { PageHeader, JadwalTab, RekapTab, CatatanTab },
  setup() {
    const tab = ref(TABS.some(([k]) => k === route.query.tab) ? route.query.tab : 'jadwal');
    const select = (k) => { tab.value = k; history.replaceState(null, '', `#/perawatan?tab=${k}`); };
    return { tab, select, TABS };
  },
  template: `<div>
    <PageHeader title="Riwayat Perawatan" subtitle="Servis, biaya, dan jadwal perawatan kendaraan" />
    <div class="card">
      <div class="tabs" role="tablist">
        <button v-for="[k, t] in TABS" :key="k" role="tab" :aria-selected="tab === k" :class="{ active: tab === k }" @click="select(k)">{{ t }}</button>
      </div>
      <JadwalTab v-if="tab === 'jadwal'" /><RekapTab v-else-if="tab === 'rekap'" /><CatatanTab v-else />
    </div>
  </div>`,
};
