// Fitur 08 (CRUD Perangkat Daerah): daftar + pencarian/filter status, form, detail relasi, hapus dengan penolakan 409.
import { ref, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { isAdmin } from '../store.js';
import { navigate, route } from '../router.js';
import { label, tone, angka } from '../format.js';
import { schemas } from '../../lib/shared/validation.js';
import { useList } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, Field, ConfirmDialog, useForm } from '../components/ui.js';

export const PerangkatDaerahList = {
  components: { Badge, EmptyState, PageHeader, Pager },
  setup() {
    return { ...useList('/perangkat-daerah', { q: '', is_aktif: '' }), isAdmin, angka };
  },
  template: `<div>
    <PageHeader title="Perangkat Daerah" subtitle="Unit kerja pemilik aset kendaraan dinas">
      <a v-if="isAdmin" class="btn primary" href="#/perangkat-daerah/baru">+ Tambah Perangkat Daerah</a>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Kode, nama, atau singkatan…"></label>
        <label class="filter"><span>Status</span><select v-model="filters.is_aktif"><option value="">Semua status</option><option value="1">Aktif</option><option value="0">Nonaktif</option></select></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Kode</th><th>Nama Dinas</th><th>Kontak</th><th class="num">PNS</th><th class="num">KDO</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id" :class="{ inactive: !p.is_aktif }">
            <td data-label="Kode"><a :href="'#/perangkat-daerah/' + p.id"><b>{{ p.kode }}</b></a></td>
            <td data-label="Nama Dinas">{{ p.nama_dinas }}<span class="sub">{{ p.singkatan }}</span></td>
            <td data-label="Kontak">{{ p.no_telepon || '-' }}<span class="sub">{{ p.email }}</span></td>
            <td data-label="PNS" class="num">{{ angka(p.jumlah_pns) }}</td>
            <td data-label="KDO" class="num">{{ angka(p.jumlah_kdo) }}</td>
            <td data-label="Status"><Badge :tone="p.is_aktif ? 'ok' : 'muted'">{{ p.is_aktif ? 'Aktif' : 'Nonaktif' }}</Badge></td>
          </tr>
        </tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada perangkat daerah yang cocok' : 'Belum ada perangkat daerah'"
        :hint="hasFilter() ? 'Ubah kata kunci atau hapus filter.' : 'Tambahkan perangkat daerah sebagai pemilik aset.'" />
      <Pager :meta="meta" @page="goTo" />
    </div>
  </div>`,
};

export const PerangkatDaerahDetail = {
  components: { Badge, PageHeader, ConfirmDialog, EmptyState },
  setup() {
    const pd = ref(null);
    const error = ref('');
    const confirming = ref(false);
    onMounted(async () => {
      try { pd.value = (await api.get(`/perangkat-daerah/${route.params.id}`)).data; } catch (e) { error.value = e.message; }
    });
    const remove = () => api.del(`/perangkat-daerah/${pd.value.id}`);
    const removed = () => navigate('/perangkat-daerah');
    return { pd, error, confirming, remove, removed, isAdmin, label, tone };
  },
  template: `<div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!pd && !error" />
    <template v-if="pd">
      <PageHeader :title="pd.nama_dinas" :subtitle="pd.kode + (pd.singkatan ? ' · ' + pd.singkatan : '')" back="#/perangkat-daerah" back-label="Perangkat Daerah">
        <template #badges> <Badge :tone="pd.is_aktif ? 'ok' : 'muted'">{{ pd.is_aktif ? 'Aktif' : 'Nonaktif' }}</Badge></template>
        <template v-if="isAdmin">
          <button class="danger" @click="confirming = true">Hapus</button>
          <a class="btn primary" :href="'#/perangkat-daerah/' + pd.id + '/ubah'">Ubah</a>
        </template>
      </PageHeader>
      <div class="card"><dl class="kv">
        <dt>Alamat</dt><dd>{{ pd.alamat || '-' }}</dd>
        <dt>Telepon</dt><dd>{{ pd.no_telepon || '-' }}</dd>
        <dt>Email</dt><dd>{{ pd.email || '-' }}</dd>
      </dl></div>
      <div class="grid two">
        <div class="card"><h2>PNS ({{ pd.pns.length }})</h2>
          <div class="table-wrap"><table><tbody>
            <tr v-for="p in pd.pns" :key="p.id"><td><a :href="'#/pns/' + p.id">{{ p.nama_pegawai }}</a><span class="sub">{{ p.nip }} · {{ p.jabatan }}</span></td>
              <td><Badge :tone="tone('status_kepegawaian', p.status_kepegawaian)">{{ label('status_kepegawaian', p.status_kepegawaian) }}</Badge></td></tr>
          </tbody></table></div>
          <EmptyState v-if="!pd.pns.length" title="Belum ada PNS di unit ini" />
        </div>
        <div class="card"><h2>Kendaraan ({{ pd.kdo.length }})</h2>
          <div class="table-wrap"><table><tbody>
            <tr v-for="k in pd.kdo" :key="k.id" :class="{ inactive: !k.is_aktif }"><td><a :href="'#/kdo/' + k.id">{{ k.nomor_polisi }}</a><span class="sub">{{ k.merek }} {{ k.tipe }}</span></td>
              <td>{{ k.pemegang_nama || 'Belum ada pemegang' }}</td>
              <td><Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge></td></tr>
          </tbody></table></div>
          <EmptyState v-if="!pd.kdo.length" title="Belum ada kendaraan di unit ini" />
        </div>
      </div>
      <ConfirmDialog v-if="confirming" title="Hapus Perangkat Daerah" :action="remove" @close="confirming = false" @done="removed">
        Hapus <b>{{ pd.nama_dinas }}</b> ({{ pd.kode }})?
        <p v-if="pd.pns.length || pd.kdo.length" class="hint">Unit ini masih memiliki {{ pd.pns.length }} PNS dan {{ pd.kdo.length }} kendaraan, sehingga penghapusan akan ditolak.</p>
      </ConfirmDialog>
    </template>
  </div>`,
};

export const PerangkatDaerahForm = {
  components: { PageHeader, Field },
  setup() {
    const id = route.params.id;
    const form = useForm(schemas.perangkatDaerah, { kode: '', nama_dinas: '', singkatan: '', alamat: '', no_telepon: '', email: '', is_aktif: 1 });
    const loaded = ref(!id);
    onMounted(async () => {
      if (!id) return;
      try { Object.assign(form.values, (await api.get(`/perangkat-daerah/${id}`)).data); loaded.value = true; } catch (e) { form.state.message = e.message; }
    });
    async function save() {
      const res = await form.submit((v) => (id ? api.put(`/perangkat-daerah/${id}`, v) : api.post('/perangkat-daerah', v)),
        { success: id ? 'Perangkat daerah diperbarui' : 'Perangkat daerah ditambahkan' });
      if (res) navigate(`/perangkat-daerah/${res.data.id}`);
    }
    return { id, loaded, ...form, save };
  },
  template: `<div v-if="!loaded"><div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div><LoadingState v-else /></div>
  <form v-else @submit.prevent="save" novalidate>
    <PageHeader :title="id ? 'Ubah Perangkat Daerah' : 'Tambah Perangkat Daerah'" :back="id ? '#/perangkat-daerah/' + id : '#/perangkat-daerah'" />
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <div class="card"><div class="form">
      <Field label="Kode" name="kode" :error="errors.kode" required hint="Contoh: PD-004"><input id="kode" v-model="values.kode" maxlength="20"></Field>
      <Field label="Nama dinas" name="nama_dinas" :error="errors.nama_dinas" required><input id="nama_dinas" v-model="values.nama_dinas" maxlength="150"></Field>
      <Field label="Singkatan" name="singkatan" :error="errors.singkatan"><input id="singkatan" v-model="values.singkatan" maxlength="30"></Field>
      <Field label="Telepon" name="no_telepon" :error="errors.no_telepon"><input id="no_telepon" v-model="values.no_telepon" inputmode="tel"></Field>
      <Field label="Email" name="email" :error="errors.email"><input id="email" v-model="values.email" type="email"></Field>
      <Field label="Status" name="is_aktif"><label class="check"><input id="is_aktif" type="checkbox" :checked="!!values.is_aktif" @change="values.is_aktif = $event.target.checked ? 1 : 0"> Aktif</label></Field>
      <Field label="Alamat" name="alamat" :error="errors.alamat" full><textarea id="alamat" v-model="values.alamat" rows="2"></textarea></Field>
    </div></div>
    <div class="actions"><button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan' }}</button>
      <a class="btn" :href="id ? '#/perangkat-daerah/' + id : '#/perangkat-daerah'">Batal</a></div>
  </form>`,
};
