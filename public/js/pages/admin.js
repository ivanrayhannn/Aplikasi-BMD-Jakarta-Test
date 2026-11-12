// Fitur 06 & 07: Masuk, Kelola Pengguna, Pengaturan Aplikasi, Log Aktivitas, dan halaman penolakan akses.
import { ref, onMounted } from '../../vendor/vue.js';
import { api, DEMO, SAMPLE } from '../api.js';
import { store, login, loadSettings } from '../store.js';
import { navigate } from '../router.js';
import { label, waktu, ENUMS } from '../format.js';
import { schemas } from '../../lib/shared/validation.js';
import { useList, fetchOptions } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, Field, EnumSelect, Modal, useForm } from '../components/ui.js';

export const LoginPage = {
  components: { Field },
  setup() {
    const form = useForm(schemas.login, { email: '', password: '' });
    async function submit() {
      const ok = await form.submit(async (v) => { await login(v.email, v.password); return true; });
      if (ok) navigate('/dashboard');
    }
    return { ...form, submit, DEMO, SAMPLE };
  },
  template: `<div class="login"><form class="card" @submit.prevent="submit" novalidate>
    <h1 class="brand-mark">SI-KDO</h1>
    <p class="lead">Sistem Informasi Kendaraan Dinas Operasional<br>Barang Milik Daerah</p>
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <Field label="Email" name="email" :error="errors.email"><input id="email" type="email" v-model="values.email" autocomplete="username" autofocus></Field>
    <Field label="Kata sandi" name="password" :error="errors.password"><input id="password" type="password" v-model="values.password" autocomplete="current-password"></Field>
    <button class="primary block" :disabled="state.busy">{{ state.busy ? 'Memproses…' : 'Masuk' }}</button>
    <div v-if="SAMPLE" class="demo-accounts">
      <b>Akun uji coba (lingkungan UAT)</b>
      <div>admin@kdo.test, sandi admin12345 (Pengelola Aset)</div>
      <div>petugas@kdo.test, sandi petugas12345 (Petugas Lapangan, hanya melihat)</div>
      <div v-if="DEMO">Versi demo: perubahan hanya tersimpan di browser ini.</div>
    </div>
  </form></div>`,
};

export const ForbiddenPage = {
  setup: () => ({ role: label('peran', store.user?.role) }),
  template: `<div class="card forbidden" role="alert">
    <h1>Akses ditolak</h1>
    <p>Halaman ini hanya dapat dibuka oleh <b>Pengelola Aset (admin)</b>. Peran Anda saat ini: <b>{{ role }}</b>.</p>
    <a class="btn primary" href="#/dashboard">Kembali ke Dashboard</a>
  </div>`,
};

export const PenggunaPage = {
  components: { Badge, EmptyState, PageHeader, Pager, Field, EnumSelect, Modal },
  setup() {
    const list = useList('/pengguna', { q: '', role: '' });
    const editing = ref(null);
    const pegawai = ref([]);
    const form = useForm(schemas.pengguna);
    onMounted(async () => (pegawai.value = await fetchOptions('/pns')));

    function open(u) {
      form.clear();
      for (const k of Object.keys(form.values)) delete form.values[k];
      Object.assign(form.values, u ? { ...u, password: '' } : { nama: '', email: '', role: 'petugas', pns_id: null, is_active: 1, password: '' });
      editing.value = u ?? {};
    }
    async function save() {
      const id = editing.value.id;
      const res = await form.submit((v) => (id ? api.put(`/pengguna/${id}`, v) : api.post('/pengguna', v)),
        { success: id ? 'Pengguna diperbarui' : 'Pengguna ditambahkan' });
      if (res) { editing.value = null; list.load(); }
    }
    return { ...list, editing, pegawai, ...form, open, save, label, waktu, me: store };
  },
  template: `<div>
    <PageHeader title="Kelola Pengguna" subtitle="Akun yang boleh memakai aplikasi beserta perannya">
      <button class="primary" @click="open()">+ Tambah Pengguna</button>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nama atau email…"></label>
        <label class="filter"><span>Peran</span><EnumSelect v-model="filters.role" group="peran" placeholder="Semua peran" /></label>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Pegawai terkait</th><th>Status</th><th></th></tr></thead>
        <tbody><tr v-for="u in rows" :key="u.id" :class="{ inactive: !u.is_active }">
          <td data-label="Nama"><b>{{ u.nama }}</b><span v-if="u.id === me.user.id" class="sub">(Anda)</span></td><td data-label="Email">{{ u.email }}</td>
          <td data-label="Peran">{{ label('peran', u.role) }}</td><td data-label="Pegawai terkait">{{ u.pns_nama || '-' }}</td>
          <td data-label="Status"><Badge :tone="u.is_active ? 'ok' : 'muted'">{{ u.is_active ? 'Aktif' : 'Nonaktif' }}</Badge></td>
          <td data-label=""><button class="small" @click="open(u)">Ubah</button></td></tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" title="Tidak ada pengguna yang cocok" />
      <Pager :meta="meta" @page="goTo" />
    </div>
    <Modal v-if="editing" :title="editing.id ? 'Ubah Pengguna' : 'Tambah Pengguna'" @close="editing = null">
      <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
      <form class="form" @submit.prevent="save" novalidate>
        <Field label="Nama" name="nama" :error="errors.nama" required full><input id="nama" v-model="values.nama"></Field>
        <Field label="Email" name="email" :error="errors.email" required full><input id="email" type="email" v-model="values.email"></Field>
        <Field label="Peran" name="role" :error="errors.role" required><EnumSelect id="role" v-model="values.role" group="peran" /></Field>
        <Field label="Pegawai terkait" name="pns_id" :error="errors.pns_id"><select id="pns_id" v-model.number="values.pns_id"><option :value="null">Tidak terkait</option>
          <option v-for="p in pegawai" :key="p.id" :value="p.id">{{ p.nama_pegawai }}</option></select></Field>
        <Field :label="editing.id ? 'Kata sandi baru' : 'Kata sandi awal'" name="password" :error="errors.password" :required="!editing.id"
          :hint="editing.id ? 'Kosongkan bila tidak diubah. Minimal 8 karakter.' : 'Minimal 8 karakter'" full>
          <input id="password" type="password" v-model="values.password" autocomplete="new-password"></Field>
        <Field label="Status" name="is_active" full><label class="check"><input id="is_active" type="checkbox" :checked="!!values.is_active"
          @change="values.is_active = $event.target.checked ? 1 : 0"> Aktif (pengguna nonaktif tidak dapat masuk)</label></Field>
        <footer class="field full"><button type="button" @click="editing = null">Batal</button>
          <button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan' }}</button></footer>
      </form>
    </Modal>
  </div>`,
};

export const PengaturanPage = {
  components: { PageHeader, Field },
  setup() {
    const form = useForm(schemas.pengaturan, { ...store.settings });
    const logoError = ref('');
    function pickLogo(e) {
      logoError.value = '';
      const file = e.target.files?.[0];
      if (!file) return;
      if (!/^image\/(png|jpeg|svg\+xml)$/.test(file.type)) { logoError.value = 'Format logo harus PNG, JPG, atau SVG'; return; }
      if (file.size > 300 * 1024) { logoError.value = 'Ukuran logo maksimal 300 KB'; return; }
      const reader = new FileReader();
      reader.onload = () => (form.values.logo_url = reader.result);
      reader.onerror = () => (logoError.value = 'Logo gagal dibaca, coba berkas lain');
      reader.readAsDataURL(file);
    }
    async function save() {
      const ok = await form.submit((v) => api.put('/pengaturan', v), { success: 'Pengaturan disimpan' });
      if (ok) await loadSettings();
    }
    return { ...form, logoError, pickLogo, save, ENUMS };
  },
  template: `<form @submit.prevent="save" novalidate>
    <PageHeader title="Pengaturan Aplikasi" subtitle="Data instansi untuk kop laporan, pengingat, dan pilihan terkendali" />
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <div class="grid two">
      <div class="card"><h2>Data Instansi</h2><div class="form one">
        <Field label="Nama instansi" name="nama_instansi" :error="errors.nama_instansi" required><input id="nama_instansi" v-model="values.nama_instansi"></Field>
        <Field label="Alamat" name="alamat" :error="errors.alamat"><textarea id="alamat" v-model="values.alamat" rows="2"></textarea></Field>
        <Field label="Logo" name="logo" :error="logoError || errors.logo_url" hint="PNG/JPG/SVG, maks. 300 KB">
          <input id="logo" type="file" accept="image/png,image/jpeg,image/svg+xml" @change="pickLogo">
          <button v-if="values.logo_url" type="button" class="link" @click="values.logo_url = null">Hapus logo</button></Field>
        </div>
        <div class="kop preview"><img v-if="values.logo_url" :src="values.logo_url" alt="Pratinjau logo">
          <div><b>{{ values.nama_instansi || 'Nama instansi' }}</b><span>{{ values.alamat }}</span></div></div>
        <p class="hint">Pratinjau kop laporan</p>
      </div>
      <div class="card"><h2>Pengingat</h2><div class="form one">
        <Field label="Pengingat servis (hari sebelum jadwal)" name="pengingat_servis_hari" :error="errors.pengingat_servis_hari" required>
          <input id="pengingat_servis_hari" type="number" min="1" max="365" v-model="values.pengingat_servis_hari"></Field>
        <Field label="Pengingat pembaruan data kendaraan (hari)" name="pengingat_pembaruan_hari" :error="errors.pengingat_pembaruan_hari" required
          hint="Kendaraan yang datanya tidak diubah selama periode ini ditandai di dashboard">
          <input id="pengingat_pembaruan_hari" type="number" min="1" max="3650" v-model="values.pengingat_pembaruan_hari"></Field>
      </div></div>
    </div>
    <div class="actions"><button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan Pengaturan' }}</button></div>
    <div class="card" style="margin-top:16px"><h2>Pilihan Terkendali</h2>
      <p class="hint">Nilai tetap (ENUM) yang dipakai form kendaraan & pegawai. Nilai di luar daftar ditolak. Menambah pilihan memerlukan pembaruan aplikasi (migrasi), bukan tabel kategori.</p>
      <div class="enum-grid">
        <div v-for="g in ['jenis_kendaraan', 'peruntukan', 'kondisi', 'bahan_bakar', 'golongan', 'status_kepegawaian', 'jenis_perawatan']" :key="g">
          <h3>{{ g.replaceAll('_', ' ') }}</h3><span v-for="o in ENUMS[g]" :key="o.value" class="chip">{{ o.label }}</span>
        </div>
      </div>
    </div>
  </form>`,
};

export const LogPage = {
  components: { PageHeader, Pager, EmptyState },
  setup() {
    return { ...useList('/log-aktivitas', { entitas: '' }), waktu };
  },
  template: `<div>
    <PageHeader title="Log Aktivitas" subtitle="Jejak audit seluruh perubahan data" />
    <div class="card">
      <div class="filters"><label class="filter"><span>Jenis data</span><select v-model="filters.entitas"><option value="">Semua data</option>
        <option v-for="e in ['kdo', 'pns', 'perangkat_daerah', 'users', 'settings']" :key="e" :value="e">{{ e }}</option></select></label></div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Data</th><th>Detail</th></tr></thead>
        <tbody><tr v-for="l in rows" :key="l.id"><td data-label="Waktu" class="nowrap">{{ waktu(l.waktu) }}</td><td data-label="Pengguna">{{ l.pengguna || '-' }}</td>
          <td data-label="Aksi"><span class="badge muted">{{ l.aksi }}</span></td><td data-label="Data">{{ l.entitas }}{{ l.entitas_id ? ' #' + l.entitas_id : '' }}</td>
          <td data-label="Detail"><code class="detail">{{ l.detail }}</code></td></tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" title="Belum ada aktivitas" />
      <Pager :meta="meta" @page="goTo" />
    </div>
  </div>`,
};
