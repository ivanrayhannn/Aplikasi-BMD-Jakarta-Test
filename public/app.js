import { createApp, reactive, ref, computed, watch, onMounted } from '/vendor/vue.js';

// ---------------- State & API ----------------
const store = reactive({
  token: sessionStorage.getItem('kdo_token'),
  user: null,
  ref: { kondisi: [], status: [], jenis: [] },
  route: { name: 'dashboard', params: {} },
  toast: null,
});
const isAdmin = computed(() => store.user?.peran === 'admin');

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(store.token ? { authorization: `Bearer ${store.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && path !== '/login') { logoutLocal(); throw new Error('Sesi berakhir, silakan login kembali'); }
  if (raw) { if (!res.ok) throw new Error('Gagal mengunduh'); return res; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Terjadi kesalahan');
  return data;
}
function logoutLocal() { store.token = null; store.user = null; sessionStorage.removeItem('kdo_token'); }
function toast(msg) { store.toast = msg; clearTimeout(toast.t); toast.t = setTimeout(() => (store.toast = null), 3000); }

// ---------------- Router (hash) ----------------
const ROUTES = [
  ['dashboard', /^\/?$|^\/dashboard$/],
  ['kendaraan-baru', /^\/kendaraan\/baru$/],
  ['kendaraan-ubah', /^\/kendaraan\/(\d+)\/ubah$/],
  ['kendaraan-detail', /^\/kendaraan\/(\d+)$/],
  ['kendaraan', /^\/kendaraan$/],
  ['pegawai', /^\/pegawai$/],
  ['perangkat-daerah', /^\/perangkat-daerah$/],
  ['log', /^\/log$/],
];
function resolveRoute() {
  const [path, qs] = location.hash.slice(1).split('?');
  for (const [name, re] of ROUTES) {
    const m = path.match(re);
    if (m) { store.route = { name, params: { id: m[1] }, query: Object.fromEntries(new URLSearchParams(qs)) }; return; }
  }
  store.route = { name: 'dashboard', params: {}, query: {} };
}
window.addEventListener('hashchange', resolveRoute);
const go = (path) => (location.hash = path);

// ---------------- Helpers ----------------
const fmtDate = (d) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const fmtRp = (n) => (n == null ? '—' : 'Rp ' + Number(n).toLocaleString('id-ID'));
const today = () => new Date().toISOString().slice(0, 10);
const kondisiClass = (k) => ({ Baik: 'ok', 'Rusak Ringan': 'warn', 'Rusak Berat': 'bad' })[k] ?? 'muted';
const statusClass = (s) => ({ Aktif: 'ok', 'Usulan Penghapusan': 'warn', Dihapus: 'muted' })[s] ?? 'muted';
const stnkClass = (d) => {
  if (!d) return 'muted';
  const days = (new Date(d) - new Date(today())) / 864e5;
  return days < 0 ? 'bad' : days <= 30 ? 'warn' : 'ok';
};
const helpers = { fmtDate, fmtRp, kondisiClass, statusClass, stnkClass, store, isAdmin, go };

// ---------------- Komponen ----------------
const Modal = {
  props: ['title'],
  emits: ['close'],
  template: `<div class="modal-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" :aria-label="title"><h2>{{ title }}</h2><slot /></div></div>`,
};

const Login = {
  setup() {
    const f = reactive({ username: '', password: '' });
    const err = ref(''), busy = ref(false);
    async function submit() {
      err.value = ''; busy.value = true;
      try {
        const r = await api('/login', { method: 'POST', body: f });
        store.token = r.token; store.user = r.pengguna;
        sessionStorage.setItem('kdo_token', r.token);
        await loadRef();
        go('/dashboard');
      } catch (e) { err.value = e.message; } finally { busy.value = false; }
    }
    return { f, err, busy, submit };
  },
  template: `<div class="login"><form class="card" @submit.prevent="submit">
    <h1>SI-<span>KDO</span></h1>
    <p>Sistem Informasi Kendaraan Dinas Operasional<br>Barang Milik Daerah</p>
    <div v-if="err" class="alert error">{{ err }}</div>
    <div class="field"><label for="u">Username</label><input id="u" v-model="f.username" autocomplete="username" required autofocus></div>
    <div class="field"><label for="p">Kata sandi</label><input id="p" type="password" v-model="f.password" autocomplete="current-password" required></div>
    <button class="primary" :disabled="busy">{{ busy ? 'Memproses…' : 'Masuk' }}</button>
    <div class="demo"><b>Akun demo</b><br>admin / admin123 (Administrator BPAD)<br>dishub / dishub123 · dinkes / dinkes123 (Pengurus Barang OPD)</div>
  </form></div>`,
};

const Dashboard = {
  setup() {
    const d = ref(null), err = ref('');
    onMounted(async () => { try { d.value = await api('/dashboard'); } catch (e) { err.value = e.message; } });
    const kondisi = (k) => d.value?.per_kondisi.find((x) => x.kondisi === k)?.jumlah ?? 0;
    return { d, err, kondisi, ...helpers };
  },
  template: `<div>
    <div class="page-head"><div><h1>Dashboard</h1>
      <p>{{ isAdmin ? 'Rekapitulasi KDO seluruh Perangkat Daerah' : 'Rekapitulasi KDO ' + store.user.perangkat_daerah }}</p></div></div>
    <div v-if="err" class="alert error">{{ err }}</div>
    <template v-if="d">
      <div class="grid stats" style="margin-bottom:16px">
        <a class="stat" href="#/kendaraan"><div class="label">Total KDO</div><div class="value">{{ d.total }}</div></a>
        <a class="stat ok" href="#/kendaraan?kondisi=Baik"><div class="label">Kondisi Baik</div><div class="value">{{ kondisi('Baik') }}</div></a>
        <a class="stat warn" href="#/kendaraan?kondisi=Rusak Ringan"><div class="label">Rusak Ringan</div><div class="value">{{ kondisi('Rusak Ringan') }}</div></a>
        <a class="stat bad" href="#/kendaraan?kondisi=Rusak Berat"><div class="label">Rusak Berat</div><div class="value">{{ kondisi('Rusak Berat') }}</div></a>
        <a class="stat warn" href="#/kendaraan?tanpa_pj=1"><div class="label">Tanpa Penanggung Jawab</div><div class="value">{{ d.tanpa_penanggung_jawab }}</div></a>
        <div class="stat warn"><div class="label">Belum diperiksa &gt; 6 bln</div><div class="value">{{ d.belum_diperiksa_6_bulan }}</div></div>
      </div>
      <div class="grid two">
        <div class="card"><h2>Kondisi KDO per Perangkat Daerah</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>Perangkat Daerah</th><th>Jumlah</th><th style="width:40%">Komposisi</th></tr></thead>
            <tbody>
              <tr v-for="r in d.per_perangkat_daerah" :key="r.nama">
                <td>{{ r.nama }}<span class="sub">Baik {{ r.baik }} · RR {{ r.rusak_ringan }} · RB {{ r.rusak_berat }}</span></td>
                <td class="num">{{ r.jumlah }}</td>
                <td><div class="bar" :title="'Baik ' + r.baik + ', Rusak Ringan ' + r.rusak_ringan + ', Rusak Berat ' + r.rusak_berat">
                  <span :style="{width: r.baik/r.jumlah*100+'%', background:'var(--ok)'}"></span>
                  <span :style="{width: r.rusak_ringan/r.jumlah*100+'%', background:'#d89a2b'}"></span>
                  <span :style="{width: r.rusak_berat/r.jumlah*100+'%', background:'var(--bad)'}"></span></div></td>
              </tr>
              <tr v-if="!d.per_perangkat_daerah.length"><td colspan="3" class="empty">Belum ada data</td></tr>
            </tbody></table></div>
        </div>
        <div class="card"><h2>STNK habis / segera habis (≤ 30 hari)</h2>
          <div class="table-wrap"><table>
            <thead><tr><th>No. Polisi</th><th>Kendaraan</th><th>Berlaku s.d.</th></tr></thead>
            <tbody>
              <tr v-for="k in d.stnk_segera_habis" :key="k.id">
                <td><a :href="'#/kendaraan/' + k.id">{{ k.nomor_polisi }}</a></td><td>{{ k.merk }} {{ k.tipe }}</td>
                <td><span class="badge" :class="stnkClass(k.masa_berlaku_stnk)">{{ fmtDate(k.masa_berlaku_stnk) }}</span></td>
              </tr>
              <tr v-if="!d.stnk_segera_habis.length"><td colspan="3" class="empty">Tidak ada STNK yang akan habis</td></tr>
            </tbody></table></div>
        </div>
      </div>
    </template>
  </div>`,
};

const KendaraanList = {
  setup() {
    const rows = ref([]), pds = ref([]), err = ref(''), loading = ref(false);
    const q = reactive({ q: '', perangkat_daerah_id: '', kondisi: '', status: '', jenis: '', tanpa_pj: '', ...store.route.query });
    const qs = () => new URLSearchParams(Object.entries(q).filter(([, v]) => v)).toString();
    async function load() {
      loading.value = true; err.value = '';
      try { rows.value = await api('/kendaraan?' + qs()); } catch (e) { err.value = e.message; } finally { loading.value = false; }
    }
    let t; watch(q, () => { clearTimeout(t); t = setTimeout(load, 250); });
    onMounted(async () => { load(); if (isAdmin.value) pds.value = await api('/perangkat-daerah'); });
    async function exportCsv() {
      try {
        const res = await api('/laporan/kendaraan.csv?' + qs(), { raw: true });
        const url = URL.createObjectURL(await res.blob());
        const a = Object.assign(document.createElement('a'), { href: url, download: `laporan-kdo-${today()}.csv` });
        a.click(); URL.revokeObjectURL(url);
      } catch (e) { err.value = e.message; }
    }
    return { rows, pds, q, err, loading, exportCsv, ...helpers };
  },
  template: `<div>
    <div class="page-head"><div><h1>Data Kendaraan Dinas</h1><p>{{ rows.length }} kendaraan ditemukan</p></div>
      <div class="actions"><button @click="exportCsv">Ekspor CSV</button><a class="btn primary" href="#/kendaraan/baru">+ Tambah KDO</a></div></div>
    <div v-if="err" class="alert error">{{ err }}</div>
    <div class="card">
      <div class="filters">
        <input v-model="q.q" placeholder="Cari no. polisi, merk, penanggung jawab…" style="flex:1;min-width:220px" aria-label="Cari">
        <select v-if="isAdmin" v-model="q.perangkat_daerah_id" aria-label="Perangkat Daerah"><option value="">Semua Perangkat Daerah</option>
          <option v-for="p in pds" :value="p.id">{{ p.nama }}</option></select>
        <select v-model="q.jenis" aria-label="Jenis"><option value="">Semua jenis</option><option v-for="j in store.ref.jenis">{{ j }}</option></select>
        <select v-model="q.kondisi" aria-label="Kondisi"><option value="">Semua kondisi</option><option v-for="k in store.ref.kondisi">{{ k }}</option></select>
        <select v-model="q.status" aria-label="Status"><option value="">Semua status</option><option v-for="s in store.ref.status">{{ s }}</option></select>
        <select v-model="q.tanpa_pj" aria-label="Penanggung jawab"><option value="">Semua penanggung jawab</option><option value="1">Belum ada penanggung jawab</option></select>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>No. Polisi</th><th>Kendaraan</th><th v-if="isAdmin">Perangkat Daerah</th><th>Kondisi</th><th>Status</th><th>Penanggung Jawab</th><th>STNK</th></tr></thead>
        <tbody>
          <tr v-for="k in rows" :key="k.id">
            <td><a :href="'#/kendaraan/' + k.id"><b>{{ k.nomor_polisi }}</b></a><span class="sub">{{ k.kode_barang }} / {{ k.nomor_register }}</span></td>
            <td>{{ k.merk }} {{ k.tipe }}<span class="sub">{{ k.jenis }} · {{ k.tahun_perolehan }}</span></td>
            <td v-if="isAdmin">{{ k.perangkat_daerah }}</td>
            <td><span class="badge" :class="kondisiClass(k.kondisi)">{{ k.kondisi }}</span></td>
            <td><span class="badge" :class="statusClass(k.status)">{{ k.status }}</span></td>
            <td><template v-if="k.pj_nama">{{ k.pj_nama }}<span class="sub">{{ k.pj_jabatan }}</span></template>
              <span v-else class="badge warn">Belum ditetapkan</span></td>
            <td><span class="badge" :class="stnkClass(k.masa_berlaku_stnk)">{{ fmtDate(k.masa_berlaku_stnk) }}</span></td>
          </tr>
          <tr v-if="!rows.length && !loading"><td colspan="7" class="empty">Tidak ada kendaraan sesuai filter</td></tr>
        </tbody></table></div>
    </div></div>`,
};

const KENDARAAN_FIELDS = [
  ['kode_barang', 'Kode barang', true, 'text', 'Sesuai kodefikasi BMD, mis. 1.3.2.02.01.01.003'],
  ['nomor_register', 'Nomor register', true],
  ['nomor_polisi', 'Nomor polisi', true, 'text', 'Contoh: B 1234 PQR'],
  ['jenis', 'Jenis kendaraan', true, 'jenis'],
  ['merk', 'Merk', true], ['tipe', 'Tipe / model'],
  ['tahun_perolehan', 'Tahun perolehan', true, 'number'],
  ['nilai_perolehan', 'Nilai perolehan (Rp)', false, 'number'],
  ['nomor_rangka', 'Nomor rangka', true], ['nomor_mesin', 'Nomor mesin', true],
  ['nomor_bpkb', 'Nomor BPKB'], ['warna', 'Warna'],
  ['isi_silinder', 'Isi silinder (cc)', false, 'number'],
  ['bahan_bakar', 'Bahan bakar', false, 'bbm'],
  ['masa_berlaku_stnk', 'Masa berlaku STNK', false, 'date'],
];

const KendaraanForm = {
  setup() {
    const id = store.route.params.id;
    const f = reactive({ perangkat_daerah_id: store.user.perangkat_daerah_id, jenis: 'Roda 4', kondisi: 'Baik', status: 'Aktif' });
    const pds = ref([]), err = ref(''), busy = ref(false), original = ref(null);
    onMounted(async () => {
      pds.value = await api('/perangkat-daerah');
      if (id) { const k = await api('/kendaraan/' + id); original.value = k; for (const key of Object.keys(k)) f[key] = k[key]; }
    });
    async function submit() {
      err.value = ''; busy.value = true;
      try {
        const body = { ...f }; delete body.riwayat_kondisi; delete body.riwayat_penanggung_jawab;
        const r = await api(id ? '/kendaraan/' + id : '/kendaraan', { method: id ? 'PUT' : 'POST', body });
        toast(id ? 'Data kendaraan diperbarui' : 'Kendaraan berhasil ditambahkan');
        go('/kendaraan/' + r.id);
      } catch (e) { err.value = e.message; window.scrollTo(0, 0); } finally { busy.value = false; }
    }
    return { id, f, pds, err, busy, submit, original, fields: KENDARAAN_FIELDS, ...helpers };
  },
  template: `<form @submit.prevent="submit">
    <div class="page-head"><div><h1>{{ id ? 'Ubah Data KDO' : 'Tambah KDO' }}</h1>
      <p v-if="id && original">{{ original.nomor_polisi }} · {{ original.merk }} {{ original.tipe }}</p></div></div>
    <div v-if="err" class="alert error">{{ err }}</div>
    <div class="card"><h2>Identitas Barang & Kendaraan</h2>
      <div class="form">
        <div class="field" v-if="isAdmin"><label>Perangkat Daerah <span class="req">*</span></label>
          <select v-model.number="f.perangkat_daerah_id" required><option v-for="p in pds" :value="p.id">{{ p.nama }}</option></select></div>
        <div class="field" v-for="[key, label, req, type, hint] in fields" :key="key">
          <label :for="key">{{ label }} <span v-if="req" class="req">*</span></label>
          <select v-if="type === 'jenis'" :id="key" v-model="f[key]" :required="req"><option v-for="j in store.ref.jenis">{{ j }}</option></select>
          <select v-else-if="type === 'bbm'" :id="key" v-model="f[key]"><option value="">—</option>
            <option>Bensin</option><option>Solar</option><option>Listrik</option><option>Hybrid</option><option>Gas</option></select>
          <input v-else :id="key" :type="type || 'text'" v-model="f[key]" :required="req" min="0">
          <div class="hint" v-if="hint">{{ hint }}</div>
        </div>
        <div class="field" v-if="!id"><label>Kondisi awal <span class="req">*</span></label>
          <select v-model="f.kondisi"><option v-for="k in store.ref.kondisi">{{ k }}</option></select></div>
        <div class="field" v-else><label>Status</label>
          <select v-model="f.status"><option v-for="s in store.ref.status" :disabled="s === 'Dihapus' && !isAdmin">{{ s }}</option></select>
          <div class="hint">Kondisi diubah melalui menu "Catat Pemeriksaan". Status "Dihapus" hanya oleh Admin BPAD.</div></div>
        <div class="field full"><label for="ket">Keterangan</label><textarea id="ket" v-model="f.keterangan" rows="2"></textarea></div>
      </div>
    </div>
    <div class="actions"><button class="primary" :disabled="busy">{{ busy ? 'Menyimpan…' : 'Simpan' }}</button>
      <a class="btn" :href="id ? '#/kendaraan/' + id : '#/kendaraan'">Batal</a></div>
  </form>`,
};

const KendaraanDetail = {
  components: { Modal },
  setup() {
    const id = store.route.params.id;
    const k = ref(null), err = ref(''), pegawai = ref([]), modal = ref(null), mErr = ref(''), busy = ref(false);
    const fp = reactive({}), fj = reactive({}), fa = reactive({});
    async function load() { try { k.value = await api('/kendaraan/' + id); } catch (e) { err.value = e.message; } }
    onMounted(load);
    async function open(name) {
      mErr.value = ''; modal.value = name;
      if (name === 'periksa') Object.assign(fp, { tanggal: today(), kondisi: k.value.kondisi, kilometer: '', catatan: '' });
      if (name === 'pj') {
        Object.assign(fj, { pegawai_id: '', nomor_bast: '', tanggal_mulai: today(), keterangan: '' });
        pegawai.value = (await api(`/pegawai?aktif=1&perangkat_daerah_id=${k.value.perangkat_daerah_id}`))
          .filter((p) => p.perangkat_daerah_id === k.value.perangkat_daerah_id);
      }
      if (name === 'akhiri') Object.assign(fa, { tanggal_selesai: today(), keterangan: '' });
    }
    async function submit(path, body, msg) {
      mErr.value = ''; busy.value = true;
      try { await api(`/kendaraan/${id}/${path}`, { method: 'POST', body }); modal.value = null; toast(msg); await load(); }
      catch (e) { mErr.value = e.message; } finally { busy.value = false; }
    }
    return { id, k, err, pegawai, modal, mErr, busy, fp, fj, fa, open, submit, ...helpers };
  },
  template: `<div>
    <div v-if="err" class="alert error">{{ err }}</div>
    <template v-if="k">
      <div class="page-head"><div><a href="#/kendaraan">← Data Kendaraan</a>
        <h1 style="margin-top:6px">{{ k.nomor_polisi }} <span class="badge" :class="kondisiClass(k.kondisi)">{{ k.kondisi }}</span>
          <span class="badge" :class="statusClass(k.status)">{{ k.status }}</span></h1>
        <p>{{ k.merk }} {{ k.tipe }} · {{ k.perangkat_daerah }}</p></div>
        <div class="actions" v-if="k.status !== 'Dihapus'">
          <button @click="open('periksa')">Catat Pemeriksaan</button>
          <button v-if="k.status === 'Aktif'" @click="open('pj')">{{ k.pj_nama ? 'Ganti' : 'Tetapkan' }} Penanggung Jawab</button>
          <a class="btn primary" :href="'#/kendaraan/' + k.id + '/ubah'">Ubah Data</a></div></div>

      <div class="grid two">
        <div class="card"><h2>Identitas Kendaraan</h2><dl class="kv">
          <dt>Kode barang / Register</dt><dd>{{ k.kode_barang }} / {{ k.nomor_register }}</dd>
          <dt>Jenis</dt><dd>{{ k.jenis }}</dd>
          <dt>Tahun perolehan</dt><dd>{{ k.tahun_perolehan }}</dd>
          <dt>Nilai perolehan</dt><dd>{{ fmtRp(k.nilai_perolehan) }}</dd>
          <dt>No. rangka</dt><dd>{{ k.nomor_rangka }}</dd>
          <dt>No. mesin</dt><dd>{{ k.nomor_mesin }}</dd>
          <dt>No. BPKB</dt><dd>{{ k.nomor_bpkb || '—' }}</dd>
          <dt>Warna / CC / BBM</dt><dd>{{ k.warna || '—' }} / {{ k.isi_silinder || '—' }} / {{ k.bahan_bakar || '—' }}</dd>
          <dt>Masa berlaku STNK</dt><dd><span class="badge" :class="stnkClass(k.masa_berlaku_stnk)">{{ fmtDate(k.masa_berlaku_stnk) }}</span></dd>
          <dt>Keterangan</dt><dd>{{ k.keterangan || '—' }}</dd>
        </dl></div>
        <div class="card"><h2>Penanggung Jawab Saat Ini</h2>
          <template v-if="k.pj_nama"><dl class="kv">
            <dt>Nama</dt><dd>{{ k.pj_nama }}</dd><dt>NIP</dt><dd>{{ k.pj_nip }}</dd>
            <dt>Jabatan</dt><dd>{{ k.pj_jabatan }}</dd><dt>No. BAST</dt><dd>{{ k.pj_nomor_bast }}</dd>
            <dt>Sejak</dt><dd>{{ fmtDate(k.pj_tanggal_mulai) }}</dd></dl>
            <button class="danger small" style="margin-top:14px" @click="open('akhiri')">Akhiri Penugasan</button></template>
          <div v-else class="alert info">Kendaraan belum memiliki penanggung jawab.</div>
        </div>
      </div>

      <div class="card"><h2>Riwayat Pemeriksaan Kondisi</h2><div class="table-wrap"><table>
        <thead><tr><th>Tanggal</th><th>Kondisi</th><th>Kilometer</th><th>Catatan</th><th>Dicatat oleh</th></tr></thead>
        <tbody><tr v-for="r in k.riwayat_kondisi" :key="r.id">
          <td>{{ fmtDate(r.tanggal) }}</td><td><span class="badge" :class="kondisiClass(r.kondisi)">{{ r.kondisi }}</span></td>
          <td class="num">{{ r.kilometer != null ? r.kilometer.toLocaleString('id-ID') : '—' }}</td><td>{{ r.catatan || '—' }}</td><td>{{ r.pencatat || '—' }}</td></tr>
          <tr v-if="!k.riwayat_kondisi.length"><td colspan="5" class="empty">Belum ada pemeriksaan</td></tr></tbody></table></div></div>

      <div class="card"><h2>Riwayat Penanggung Jawab</h2><div class="table-wrap"><table>
        <thead><tr><th>Pegawai</th><th>No. BAST</th><th>Mulai</th><th>Selesai</th><th>Keterangan</th></tr></thead>
        <tbody><tr v-for="r in k.riwayat_penanggung_jawab" :key="r.id">
          <td>{{ r.nama }}<span class="sub">{{ r.nip }} · {{ r.jabatan }}</span></td><td>{{ r.nomor_bast }}</td>
          <td>{{ fmtDate(r.tanggal_mulai) }}</td><td><span v-if="!r.tanggal_selesai" class="badge ok">Aktif</span><template v-else>{{ fmtDate(r.tanggal_selesai) }}</template></td>
          <td>{{ r.keterangan || '—' }}</td></tr>
          <tr v-if="!k.riwayat_penanggung_jawab.length"><td colspan="5" class="empty">Belum ada riwayat</td></tr></tbody></table></div></div>
    </template>

    <Modal v-if="modal === 'periksa'" title="Catat Pemeriksaan Kondisi" @close="modal = null">
      <div v-if="mErr" class="alert error">{{ mErr }}</div>
      <form class="form" @submit.prevent="submit('pemeriksaan', fp, 'Pemeriksaan tersimpan')">
        <div class="field"><label>Tanggal <span class="req">*</span></label><input type="date" v-model="fp.tanggal" :max="new Date().toISOString().slice(0,10)" required></div>
        <div class="field"><label>Kondisi <span class="req">*</span></label><select v-model="fp.kondisi"><option v-for="x in store.ref.kondisi">{{ x }}</option></select></div>
        <div class="field"><label>Kilometer (odometer)</label><input type="number" min="0" v-model="fp.kilometer"></div>
        <div class="field full"><label>Catatan <span v-if="fp.kondisi !== 'Baik'" class="req">*</span></label>
          <textarea v-model="fp.catatan" rows="3" :required="fp.kondisi !== 'Baik'" placeholder="Uraian kerusakan / hasil pemeriksaan"></textarea></div>
        <footer class="field full"><button type="button" @click="modal = null">Batal</button><button class="primary" :disabled="busy">Simpan</button></footer>
      </form></Modal>

    <Modal v-if="modal === 'pj'" :title="(k.pj_nama ? 'Ganti' : 'Tetapkan') + ' Penanggung Jawab'" @close="modal = null">
      <div v-if="k.pj_nama" class="alert info">Penugasan {{ k.pj_nama }} akan otomatis diakhiri pada tanggal mulai penanggung jawab baru.</div>
      <div v-if="mErr" class="alert error">{{ mErr }}</div>
      <form class="form" @submit.prevent="submit('penanggung-jawab', fj, 'Penanggung jawab ditetapkan')">
        <div class="field full"><label>Pegawai <span class="req">*</span></label>
          <select v-model.number="fj.pegawai_id" required><option value="" disabled>Pilih pegawai {{ k.perangkat_daerah }}</option>
            <option v-for="p in pegawai" :value="p.id" :disabled="p.id === k.pj_pegawai_id">{{ p.nama }} — {{ p.jabatan }}{{ p.jumlah_kdo ? ' (memegang ' + p.jumlah_kdo + ' KDO)' : '' }}</option></select>
          <div class="hint" v-if="!pegawai.length">Belum ada pegawai aktif. Tambahkan di menu Pegawai.</div></div>
        <div class="field"><label>Nomor BAST <span class="req">*</span></label><input v-model="fj.nomor_bast" required></div>
        <div class="field"><label>Tanggal mulai <span class="req">*</span></label><input type="date" v-model="fj.tanggal_mulai" required></div>
        <div class="field full"><label>Keterangan</label><textarea v-model="fj.keterangan" rows="2"></textarea></div>
        <footer class="field full"><button type="button" @click="modal = null">Batal</button><button class="primary" :disabled="busy">Simpan</button></footer>
      </form></Modal>

    <Modal v-if="modal === 'akhiri'" title="Akhiri Penugasan Penanggung Jawab" @close="modal = null">
      <p>Akhiri penugasan <b>{{ k.pj_nama }}</b> atas kendaraan {{ k.nomor_polisi }}?</p>
      <div v-if="mErr" class="alert error">{{ mErr }}</div>
      <form class="form" @submit.prevent="submit('penanggung-jawab/akhiri', fa, 'Penugasan diakhiri')">
        <div class="field"><label>Tanggal selesai <span class="req">*</span></label><input type="date" v-model="fa.tanggal_selesai" required></div>
        <div class="field full"><label>Alasan / keterangan</label><textarea v-model="fa.keterangan" rows="2" placeholder="Mis. mutasi, pensiun, kendaraan dikembalikan"></textarea></div>
        <footer class="field full"><button type="button" @click="modal = null">Batal</button><button class="primary danger" :disabled="busy">Akhiri</button></footer>
      </form></Modal>
  </div>`,
};

const PegawaiPage = {
  components: { Modal },
  setup() {
    const rows = ref([]), pds = ref([]), q = ref(''), err = ref(''), mErr = ref(''), editing = ref(null), busy = ref(false);
    const f = reactive({});
    async function load() { try { rows.value = await api('/pegawai?q=' + encodeURIComponent(q.value)); } catch (e) { err.value = e.message; } }
    let t; watch(q, () => { clearTimeout(t); t = setTimeout(load, 250); });
    onMounted(async () => { load(); pds.value = await api('/perangkat-daerah'); });
    function edit(p) {
      mErr.value = ''; editing.value = p ?? {};
      Object.assign(f, p ? { ...p, aktif: !!p.aktif } : { nip: '', nama: '', jabatan: '', perangkat_daerah_id: store.user.perangkat_daerah_id, aktif: true });
    }
    async function save() {
      busy.value = true; mErr.value = '';
      try {
        await api(editing.value.id ? '/pegawai/' + editing.value.id : '/pegawai', { method: editing.value.id ? 'PUT' : 'POST', body: f });
        editing.value = null; toast('Data pegawai tersimpan'); load();
      } catch (e) { mErr.value = e.message; } finally { busy.value = false; }
    }
    return { rows, pds, q, err, mErr, editing, f, busy, edit, save, ...helpers };
  },
  template: `<div>
    <div class="page-head"><div><h1>Pegawai</h1><p>Pegawai yang dapat ditetapkan sebagai penanggung jawab KDO</p></div>
      <button class="primary" @click="edit()">+ Tambah Pegawai</button></div>
    <div v-if="err" class="alert error">{{ err }}</div>
    <div class="card">
      <div class="filters"><input v-model="q" placeholder="Cari nama atau NIP…" style="flex:1" aria-label="Cari pegawai"></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama / NIP</th><th>Jabatan</th><th v-if="isAdmin">Perangkat Daerah</th><th>KDO dipegang</th><th>Status</th><th></th></tr></thead>
        <tbody><tr v-for="p in rows" :key="p.id">
          <td>{{ p.nama }}<span class="sub">{{ p.nip }}</span></td><td>{{ p.jabatan }}</td>
          <td v-if="isAdmin">{{ p.perangkat_daerah }}</td><td class="num">{{ p.jumlah_kdo }}</td>
          <td><span class="badge" :class="p.aktif ? 'ok' : 'muted'">{{ p.aktif ? 'Aktif' : 'Nonaktif' }}</span></td>
          <td><button class="small" @click="edit(p)">Ubah</button></td></tr>
          <tr v-if="!rows.length"><td colspan="6" class="empty">Belum ada pegawai</td></tr></tbody></table></div>
    </div>
    <Modal v-if="editing" :title="editing.id ? 'Ubah Pegawai' : 'Tambah Pegawai'" @close="editing = null">
      <div v-if="mErr" class="alert error">{{ mErr }}</div>
      <form class="form" @submit.prevent="save">
        <div class="field full"><label>NIP <span class="req">*</span></label><input v-model="f.nip" inputmode="numeric" maxlength="18" required><div class="hint">18 digit</div></div>
        <div class="field full"><label>Nama lengkap <span class="req">*</span></label><input v-model="f.nama" required></div>
        <div class="field full"><label>Jabatan <span class="req">*</span></label><input v-model="f.jabatan" required></div>
        <div class="field full" v-if="isAdmin"><label>Perangkat Daerah <span class="req">*</span></label>
          <select v-model.number="f.perangkat_daerah_id" required><option v-for="p in pds" :value="p.id">{{ p.nama }}</option></select></div>
        <div class="field full" v-if="editing.id"><label><input type="checkbox" v-model="f.aktif" style="width:auto"> Pegawai aktif</label></div>
        <footer class="field full"><button type="button" @click="editing = null">Batal</button><button class="primary" :disabled="busy">Simpan</button></footer>
      </form></Modal>
  </div>`,
};

const PerangkatDaerahPage = {
  setup() {
    const rows = ref([]), f = reactive({ kode: '', nama: '' }), err = ref('');
    const load = async () => (rows.value = await api('/perangkat-daerah'));
    onMounted(load);
    async function add() {
      err.value = '';
      try { await api('/perangkat-daerah', { method: 'POST', body: f }); f.kode = ''; f.nama = ''; toast('Perangkat Daerah ditambahkan'); load(); }
      catch (e) { err.value = e.message; }
    }
    return { rows, f, err, add };
  },
  template: `<div>
    <div class="page-head"><div><h1>Perangkat Daerah</h1><p>Master data Perangkat Daerah pengguna barang</p></div></div>
    <div class="card"><h2>Tambah Perangkat Daerah</h2>
      <div v-if="err" class="alert error">{{ err }}</div>
      <form class="filters" @submit.prevent="add" style="margin:0">
        <input v-model="f.kode" placeholder="Kode" required style="max-width:160px" aria-label="Kode">
        <input v-model="f.nama" placeholder="Nama Perangkat Daerah" required style="flex:1" aria-label="Nama">
        <button class="primary">Tambah</button></form></div>
    <div class="card"><div class="table-wrap"><table><thead><tr><th>Kode</th><th>Nama</th></tr></thead>
      <tbody><tr v-for="p in rows" :key="p.id"><td>{{ p.kode }}</td><td>{{ p.nama }}</td></tr></tbody></table></div></div>
  </div>`,
};

const LogPage = {
  setup() {
    const rows = ref([]);
    onMounted(async () => (rows.value = await api('/log-aktivitas')));
    return { rows };
  },
  template: `<div>
    <div class="page-head"><div><h1>Log Aktivitas</h1><p>200 aktivitas terakhir (jejak audit)</p></div></div>
    <div class="card"><div class="table-wrap"><table>
      <thead><tr><th>Waktu (UTC)</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Detail</th></tr></thead>
      <tbody><tr v-for="l in rows" :key="l.id"><td style="white-space:nowrap">{{ l.waktu }}</td><td>{{ l.pengguna || '—' }}</td>
        <td><span class="badge muted">{{ l.aksi }}</span></td><td>{{ l.entitas }} {{ l.entitas_id ? '#' + l.entitas_id : '' }}</td>
        <td><code style="font-size:12px;word-break:break-all">{{ l.detail }}</code></td></tr></tbody></table></div></div>
  </div>`,
};

// ---------------- Root ----------------
async function loadRef() { store.ref = await api('/referensi'); }

const PAGES = {
  dashboard: Dashboard, kendaraan: KendaraanList, 'kendaraan-baru': KendaraanForm, 'kendaraan-ubah': KendaraanForm,
  'kendaraan-detail': KendaraanDetail, pegawai: PegawaiPage, 'perangkat-daerah': PerangkatDaerahPage, log: LogPage,
};

const App = {
  components: { Login },
  setup() {
    const ready = ref(false);
    onMounted(async () => {
      resolveRoute();
      if (store.token) {
        try { store.user = await api('/me'); await loadRef(); } catch { logoutLocal(); }
      }
      ready.value = true;
    });
    const page = computed(() => {
      const name = store.route.name;
      if (['perangkat-daerah', 'log'].includes(name) && !isAdmin.value) return Dashboard;
      return PAGES[name] ?? Dashboard;
    });
    const pageKey = computed(() => store.route.name + (store.route.params.id ?? '') + JSON.stringify(store.route.query ?? {}));
    const section = computed(() => store.route.name.split('-')[0]);
    async function logout() { try { await api('/logout', { method: 'POST' }); } catch {} logoutLocal(); }
    return { ready, page, pageKey, section, logout, store, isAdmin };
  },
  template: `<template v-if="ready">
    <Login v-if="!store.user" />
    <div v-else class="layout">
      <nav class="sidebar" aria-label="Menu utama">
        <div class="brand"><b>SI-<span>KDO</span></b><small>Kendaraan Dinas Operasional · BMD</small></div>
        <a href="#/dashboard" :class="{active: section === 'dashboard'}">Dashboard</a>
        <a href="#/kendaraan" :class="{active: section === 'kendaraan'}">Data Kendaraan</a>
        <a href="#/pegawai" :class="{active: section === 'pegawai'}">Pegawai</a>
        <template v-if="isAdmin">
          <a href="#/perangkat-daerah" :class="{active: section === 'perangkat'}">Perangkat Daerah</a>
          <a href="#/log" :class="{active: section === 'log'}">Log Aktivitas</a>
        </template>
        <div class="user"><div><b>{{ store.user.nama }}</b>{{ store.user.peran === 'admin' ? 'Administrator' : 'Pengurus Barang' }} · {{ store.user.perangkat_daerah }}</div>
          <button class="small" @click="logout">Keluar</button></div>
      </nav>
      <main><component :is="page" :key="pageKey" /></main>
    </div>
    <div v-if="store.toast" class="toast alert success" role="status">{{ store.toast }}</div>
  </template>`,
};

createApp(App).mount('#app');
