// Titik masuk frontend: rute, tata letak (sidebar + konten), dan pemeriksaan hak akses per halaman.
import { createApp, computed, ref, watch, onMounted } from '../vendor/vue.js';
import { store, isAdmin, isPegawai, restoreSession, logout } from './store.js';
import { route, defineRoute, startRouter, navigate } from './router.js';
import { DEMO, SAMPLE, resetDemo } from './api.js';
import { LoadingState, Plate } from './components/ui.js';
import { label } from './format.js';
import { Dashboard } from './pages/dashboard.js';
import { KdoList, KdoDetail, KdoForm } from './pages/kdo.js';
import { PnsList, PnsDetail, PnsForm } from './pages/pns.js';
import { PerangkatDaerahList, PerangkatDaerahDetail, PerangkatDaerahForm } from './pages/perangkat-daerah.js';
import { PemakaianPage } from './pages/pemakaian.js';
import { PerawatanPage } from './pages/perawatan.js';
import { LaporanPage } from './pages/laporan.js';
import { LoginPage, ForbiddenPage, PenggunaPage, PengaturanPage, LogPage } from './pages/admin.js';
import { RancanganDbPage } from './pages/rancangan-db.js';
import { DokumenPage } from './pages/dokumen.js';
import { PengajuanList, PengajuanDetail, BeritaAcaraList, BeritaAcaraPrint, PegawaiHome } from './pages/siklus.js';

// Urutan penting: pola statis ('/kdo/baru') sebelum pola berparameter ('/kdo/:id').
defineRoute('/dashboard', Dashboard, { section: 'dashboard' });
defineRoute('/kdo', KdoList, { section: 'kdo' });
defineRoute('/kdo/baru', KdoForm, { section: 'kdo', admin: true });
defineRoute('/kdo/:id', KdoDetail, { section: 'kdo' });
defineRoute('/kdo/:id/ubah', KdoForm, { section: 'kdo', admin: true });
defineRoute('/pns', PnsList, { section: 'pns' });
defineRoute('/pns/baru', PnsForm, { section: 'pns', admin: true });
defineRoute('/pns/:id', PnsDetail, { section: 'pns' });
defineRoute('/pns/:id/ubah', PnsForm, { section: 'pns', admin: true });
defineRoute('/perangkat-daerah', PerangkatDaerahList, { section: 'pd' });
defineRoute('/perangkat-daerah/baru', PerangkatDaerahForm, { section: 'pd', admin: true });
defineRoute('/perangkat-daerah/:id', PerangkatDaerahDetail, { section: 'pd' });
defineRoute('/perangkat-daerah/:id/ubah', PerangkatDaerahForm, { section: 'pd', admin: true });
defineRoute('/pemakaian', PemakaianPage, { section: 'pemakaian' });
defineRoute('/perawatan', PerawatanPage, { section: 'perawatan' });
defineRoute('/laporan', LaporanPage, { section: 'laporan' });
defineRoute('/pengguna', PenggunaPage, { section: 'pengguna', admin: true });
defineRoute('/pengaturan', PengaturanPage, { section: 'pengaturan', admin: true });
defineRoute('/log', LogPage, { section: 'log', admin: true });
defineRoute('/rancangan-db', RancanganDbPage, { section: 'rancangan' });
defineRoute('/saya', PegawaiHome, { section: 'saya', pegawai: true });
defineRoute('/pengajuan', PengajuanList, { section: 'pengajuan', pegawai: true });
defineRoute('/pengajuan/:id', PengajuanDetail, { section: 'pengajuan', pegawai: true });
defineRoute('/pengadaan', PengajuanList, { section: 'pengadaan', jenis: 'pengadaan' });
defineRoute('/mutasi', PengajuanList, { section: 'mutasi', jenis: 'mutasi' });
defineRoute('/disposal', PengajuanList, { section: 'disposal', jenis: 'disposal' });
defineRoute('/berita-acara', BeritaAcaraList, { section: 'berita-acara', pegawai: true });
defineRoute('/berita-acara/:id', BeritaAcaraPrint, { section: 'berita-acara', pegawai: true });
defineRoute('/dokumen', DokumenPage, { section: 'dokumen' });

// Menu mengikuti siklus hidup KDO: data pendukung (unit, pegawai) diisi sebelum kendaraan, lalu siklus aset
// (pengadaan sampai disposal), persetujuan, lalu pelaporan. Peran Pegawai hanya melihat menu swalayan.
const MENU = [
  { group: null, items: [['dashboard', '#/dashboard', 'Dashboard']] },
  { group: null, pegawai: true, items: [['saya', '#/saya', 'Beranda'], ['pengajuan', '#/pengajuan', 'Pengajuan Saya'], ['berita-acara', '#/berita-acara', 'Berita Acara']] },
  { group: 'Pendataan', items: [['pd', '#/perangkat-daerah', 'Perangkat Daerah'], ['pns', '#/pns', 'Pegawai (PNS)'], ['kdo', '#/kdo', 'Kendaraan Dinas']] },
  { group: 'Siklus Aset', items: [['pengadaan', '#/pengadaan', 'Pengadaan'], ['pemakaian', '#/pemakaian', 'Penugasan & Pengembalian'],
    ['mutasi', '#/mutasi', 'Mutasi'], ['perawatan', '#/perawatan', 'Perawatan'], ['disposal', '#/disposal', 'Disposal']] },
  { group: 'Persetujuan', items: [['pengajuan', '#/pengajuan', 'Pengajuan & Persetujuan'], ['berita-acara', '#/berita-acara', 'Berita Acara']] },
  { group: 'Pelaporan', items: [['laporan', '#/laporan', 'Laporan & Cetak']] },
  { group: 'Administrasi', admin: true, items: [['pengaturan', '#/pengaturan', 'Pengaturan Instansi'], ['pengguna', '#/pengguna', 'Kelola Pengguna'], ['log', '#/log', 'Log Aktivitas']] },
  { group: 'System Documentation', items: [['rancangan', '#/rancangan-db', 'Rancangan Database'], ['dokumen', '#/dokumen', 'Dokumen']] },
];

const App = {
  components: { LoginPage },
  setup() {
    onMounted(async () => { await restoreSession(); startRouter(); });

    const page = computed(() => {
      const m = route.match;
      if (!m) return null;
      if (isPegawai.value && !m.meta.pegawai) return ForbiddenPage;
      return m.meta.admin && !isAdmin.value ? ForbiddenPage : m.component;
    });
    // Kunci unik per rute agar komponen dibuat ulang saat berpindah antar-detail.
    const pageKey = computed(() => route.path);
    const section = computed(() => route.match?.meta.section);
    const menu = computed(() => MENU.filter((g) => (isPegawai.value ? g.pegawai : !g.pegawai) && (!g.admin || isAdmin.value)));
    // Pegawai tidak punya dashboard armada; berandanya daftar kendaraan dan pengajuan miliknya.
    watch(() => [route.path, store.user?.role], () => { if (isPegawai.value && route.path === '/dashboard') navigate('/saya'); }, { immediate: true });
    const menuOpen = ref(false); // hanya berpengaruh di layar sempit
    watch(() => route.path, () => (menuOpen.value = false));

    async function signOut() { await logout(); navigate('/dashboard'); }
    function reset() {
      if (!confirm('Kembalikan data demo ke kondisi awal? Semua perubahan akan hilang.')) return;
      resetDemo();
      location.hash = '';
      location.reload();
    }
    return { store, page, pageKey, section, menu, menuOpen, signOut, reset, DEMO, SAMPLE, roleLabel: computed(() => label('peran', store.user?.role)) };
  },
  template: `<LoadingState v-if="!store.ready" text="Membuka aplikasi…" />
  <template v-else>
    <LoginPage v-if="!store.user" />
    <div v-else class="layout">
      <div class="sidebar no-print" :class="{ open: menuOpen }">
        <header class="brand">
          <div><b>SI-KDO</b><small>{{ store.settings?.nama_instansi }}</small></div>
          <button type="button" class="menu-toggle small" aria-controls="menu-utama" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            {{ menuOpen ? 'Tutup' : 'Menu' }}</button>
        </header>
        <nav id="menu-utama" class="nav-links" aria-label="Menu utama">
          <template v-for="(g, gi) in menu" :key="gi">
            <div v-if="g.group" class="nav-group">{{ g.group }}</div>
            <a v-for="[key, href, text] in g.items" :key="key" :href="href" :class="{ active: section === key }" :aria-current="section === key ? 'page' : null">{{ text }}</a>
          </template>
        </nav>
        <footer class="user">
          <b>{{ store.user.nama }}</b><span>{{ roleLabel }}</span>
          <div class="actions"><button type="button" class="small" @click="signOut">Keluar</button>
            <button v-if="DEMO" type="button" class="small" @click="reset">Reset data demo</button></div>
        </footer>
      </div>
      <main>
        <p v-if="SAMPLE" class="sample-banner no-print">Lingkungan uji (UAT): data pegawai dan kendaraan berasal dari data uji, bukan catatan aset resmi.<template v-if="DEMO"> Perubahan pada versi demo hanya tersimpan di browser ini.</template></p>
        <component v-if="page" :is="page" :key="pageKey" />
      </main>
    </div>
    <div v-if="store.toast" class="toast" :class="store.toast.type" role="status">{{ store.toast.message }}</div>
  </template>`,
};

createApp(App).component('LoadingState', LoadingState).component('Plate', Plate).mount('#app');
