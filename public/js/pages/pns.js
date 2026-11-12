// Fitur 08 & 03 (CRUD PNS): daftar + filter status/unit, form dengan dropdown ENUM, detail kendaraan & riwayat pemakaian.
import { ref, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { isAdmin } from '../store.js';
import { navigate, route } from '../router.js';
import { label, tone, tanggal } from '../format.js';
import { schemas } from '../../lib/shared/validation.js';
import { useList, fetchOptions } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, Field, EnumSelect, ConfirmDialog, useForm } from '../components/ui.js';

export const PnsList = {
  components: { Badge, EmptyState, PageHeader, Pager, EnumSelect },
  setup() {
    const units = ref([]);
    onMounted(async () => (units.value = await fetchOptions('/perangkat-daerah')));
    return { ...useList('/pns', { q: '', status_kepegawaian: '', perangkat_daerah_id: '' }), units, isAdmin, label, tone };
  },
  template: `<div>
    <PageHeader title="PNS" subtitle="Pegawai yang dapat ditunjuk sebagai pemegang kendaraan dinas">
      <a v-if="isAdmin" class="btn primary" href="#/pns/baru">+ Tambah PNS</a>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nama, NIP, atau jabatan…"></label>
        <label class="filter"><span>Status kepegawaian</span><EnumSelect v-model="filters.status_kepegawaian" group="status_kepegawaian" placeholder="Semua status" /></label>
        <label class="filter"><span>Unit kerja</span><select v-model="filters.perangkat_daerah_id"><option value="">Semua unit kerja</option>
          <option v-for="u in units" :key="u.id" :value="String(u.id)">{{ u.nama_dinas }}</option></select></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Nama / NIP</th><th>Jabatan</th><th>Golongan</th><th>Unit Kerja</th><th class="num">KDO</th><th>Status</th></tr></thead>
        <tbody>
          <tr v-for="p in rows" :key="p.id" :class="{ inactive: p.status_kepegawaian !== 'aktif' }">
            <td data-label="Nama / NIP"><a :href="'#/pns/' + p.id"><b>{{ p.nama_pegawai }}</b></a><span class="sub">{{ p.nip }}</span></td>
            <td data-label="Jabatan">{{ p.jabatan }}</td>
            <td data-label="Golongan">{{ p.golongan || '-' }}<span class="sub">{{ p.pangkat }}</span></td>
            <td data-label="Unit Kerja">{{ p.perangkat_daerah_singkatan || p.perangkat_daerah }}</td>
            <td data-label="KDO" class="num">{{ p.jumlah_kdo }}</td>
            <td data-label="Status"><Badge :tone="tone('status_kepegawaian', p.status_kepegawaian)">{{ label('status_kepegawaian', p.status_kepegawaian) }}</Badge></td>
          </tr>
        </tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada PNS yang cocok' : 'Belum ada data PNS'"
        :hint="hasFilter() ? 'Ubah kata kunci atau hapus filter.' : 'Tambahkan pegawai yang dapat memegang kendaraan.'" />
      <Pager :meta="meta" @page="goTo" />
    </div>
  </div>`,
};

export const PnsDetail = {
  components: { Badge, PageHeader, ConfirmDialog, EmptyState },
  setup() {
    const p = ref(null);
    const error = ref('');
    const confirming = ref(false);
    onMounted(async () => {
      try { p.value = (await api.get(`/pns/${route.params.id}`)).data; } catch (e) { error.value = e.message; }
    });
    const remove = () => api.del(`/pns/${p.value.id}`);
    const removed = () => navigate('/pns');
    return { p, error, confirming, remove, removed, isAdmin, label, tone, tanggal };
  },
  template: `<div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!p && !error" />
    <template v-if="p">
      <PageHeader :title="p.nama_pegawai" :subtitle="p.nip + ' · ' + p.jabatan" back="#/pns" back-label="PNS">
        <template #badges> <Badge :tone="tone('status_kepegawaian', p.status_kepegawaian)">{{ label('status_kepegawaian', p.status_kepegawaian) }}</Badge></template>
        <template v-if="isAdmin">
          <button class="danger" @click="confirming = true">Hapus</button>
          <a class="btn primary" :href="'#/pns/' + p.id + '/ubah'">Ubah</a>
        </template>
      </PageHeader>
      <div class="card"><dl class="kv">
        <dt>Unit kerja</dt><dd><a :href="'#/perangkat-daerah/' + p.perangkat_daerah_id">{{ p.perangkat_daerah }}</a></dd>
        <dt>Golongan / Pangkat</dt><dd>{{ p.golongan || '-' }} / {{ p.pangkat || '-' }}</dd>
        <dt>Jenis kelamin</dt><dd>{{ label('jenis_kelamin', p.jenis_kelamin) }}</dd>
        <dt>No. HP / Email</dt><dd>{{ p.no_hp || '-' }} / {{ p.email || '-' }}</dd>
      </dl></div>
      <div class="card"><h2>Kendaraan yang sedang dipegang</h2>
        <div class="table-wrap"><table><tbody>
          <tr v-for="k in p.kdo_dipegang" :key="k.id"><td><a :href="'#/kdo/' + k.id"><b>{{ k.nomor_polisi }}</b></a></td><td>{{ k.merek }} {{ k.tipe }}</td>
            <td><Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge></td></tr>
        </tbody></table></div>
        <EmptyState v-if="!p.kdo_dipegang.length" title="Tidak sedang memegang kendaraan" />
      </div>
      <div class="card"><h2>Riwayat pemakaian</h2>
        <div class="table-wrap"><table class="stack">
          <thead><tr><th>Kendaraan</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody><tr v-for="r in p.riwayat_pemakaian" :key="r.id">
            <td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id">{{ r.nomor_polisi }}</a><span class="sub">{{ r.merek }} {{ r.tipe }}</span></td>
            <td data-label="Mulai">{{ tanggal(r.tanggal_mulai) }}</td><td data-label="Selesai">{{ r.tanggal_selesai ? tanggal(r.tanggal_selesai) : 'Masih berjalan' }}</td>
            <td data-label="Status"><Badge :tone="tone('status_pemakaian', r.status)">{{ label('status_pemakaian', r.status) }}</Badge></td>
            <td data-label="Keterangan">{{ r.keterangan || '-' }}</td></tr></tbody>
        </table></div>
        <EmptyState v-if="!p.riwayat_pemakaian.length" title="Belum ada riwayat pemakaian" />
      </div>
      <ConfirmDialog v-if="confirming" title="Hapus PNS" :action="remove" @close="confirming = false" @done="removed">
        Hapus data <b>{{ p.nama_pegawai }}</b> ({{ p.nip }})?
        <div v-if="p.kdo_dipegang.length" class="alert warn">
          Pegawai ini masih memegang {{ p.kdo_dipegang.length }} kendaraan
          ({{ p.kdo_dipegang.map(k => k.nomor_polisi).join(', ') }}). Pemakaiannya akan ditutup hari ini dan pemegang
          kendaraan dikosongkan. Riwayat pemakaian tetap tersimpan.
        </div>
      </ConfirmDialog>
    </template>
  </div>`,
};

export const PnsForm = {
  components: { PageHeader, Field, EnumSelect },
  setup() {
    const id = route.params.id;
    const units = ref([]);
    const form = useForm(schemas.pns, {
      nip: '', nama_pegawai: '', jabatan: '', golongan: null, pangkat: '', jenis_kelamin: null, no_hp: '', email: '',
      perangkat_daerah_id: route.query.perangkat_daerah_id ? Number(route.query.perangkat_daerah_id) : null, status_kepegawaian: 'aktif',
    });
    const loaded = ref(!id);
    onMounted(async () => {
      try {
        units.value = await fetchOptions('/perangkat-daerah');
        if (id) { Object.assign(form.values, (await api.get(`/pns/${id}`)).data); loaded.value = true; }
      } catch (e) { form.state.message = e.message; }
    });
    async function save() {
      const res = await form.submit((v) => (id ? api.put(`/pns/${id}`, v) : api.post('/pns', v)),
        { success: id ? 'Data PNS diperbarui' : 'PNS ditambahkan' });
      if (res) navigate(`/pns/${res.data.id}`);
    }
    return { id, units, loaded, ...form, save };
  },
  template: `<div v-if="!loaded"><div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div><LoadingState v-else /></div>
  <form v-else @submit.prevent="save" novalidate>
    <PageHeader :title="id ? 'Ubah PNS' : 'Tambah PNS'" :back="id ? '#/pns/' + id : '#/pns'" />
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <div class="card"><h2>Identitas Pegawai</h2><div class="form">
      <Field label="NIP" name="nip" :error="errors.nip" required hint="18 digit angka"><input id="nip" v-model="values.nip" inputmode="numeric" maxlength="21"></Field>
      <Field label="Nama pegawai" name="nama_pegawai" :error="errors.nama_pegawai" required><input id="nama_pegawai" v-model="values.nama_pegawai"></Field>
      <Field label="Jenis kelamin" name="jenis_kelamin" :error="errors.jenis_kelamin"><EnumSelect id="jenis_kelamin" v-model="values.jenis_kelamin" group="jenis_kelamin" /></Field>
      <Field label="No. HP" name="no_hp" :error="errors.no_hp"><input id="no_hp" v-model="values.no_hp" inputmode="tel"></Field>
      <Field label="Email" name="email" :error="errors.email"><input id="email" v-model="values.email" type="email"></Field>
    </div></div>
    <div class="card"><h2>Kepegawaian</h2><div class="form">
      <Field label="Unit kerja" name="perangkat_daerah_id" :error="errors.perangkat_daerah_id" required>
        <select id="perangkat_daerah_id" v-model.number="values.perangkat_daerah_id"><option :value="null">Pilih perangkat daerah</option>
          <option v-for="u in units" :key="u.id" :value="u.id" :disabled="!u.is_aktif && u.id !== values.perangkat_daerah_id">{{ u.nama_dinas }}{{ u.is_aktif ? '' : ' (nonaktif)' }}</option></select></Field>
      <Field label="Jabatan" name="jabatan" :error="errors.jabatan" required><input id="jabatan" v-model="values.jabatan"></Field>
      <Field label="Golongan" name="golongan" :error="errors.golongan"><EnumSelect id="golongan" v-model="values.golongan" group="golongan" /></Field>
      <Field label="Pangkat" name="pangkat" :error="errors.pangkat"><input id="pangkat" v-model="values.pangkat" placeholder="mis. Penata Muda"></Field>
      <Field label="Status kepegawaian" name="status_kepegawaian" :error="errors.status_kepegawaian" required>
        <EnumSelect id="status_kepegawaian" v-model="values.status_kepegawaian" group="status_kepegawaian" /></Field>
    </div></div>
    <div class="actions"><button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan' }}</button>
      <a class="btn" :href="id ? '#/pns/' + id : '#/pns'">Batal</a></div>
  </form>`,
};
