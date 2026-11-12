// Dialog domain yang dipakai di beberapa halaman: tautkan pemakai, tutup pemakaian, catat/ubah perawatan.
import { ref, computed, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { schemas } from '../../lib/shared/validation.js';
import { today, tanggal } from '../format.js';
import { fetchOptions } from './list.js';
import { Modal, Field, EnumSelect, useForm } from './ui.js';

/** Tautkan kendaraan ke pegawai. Prop `kdo`/`pns` mengunci salah satu sisi bila dibuka dari halaman detail. */
export const TautkanDialog = {
  components: { Modal, Field },
  props: { kdo: Object, pns: Object },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const form = useForm(schemas.pemakaian, {
      kdo_id: props.kdo?.id ?? null, pns_id: props.pns?.id ?? null, tanggal_mulai: today(), keterangan: '',
    });
    const kdoOptions = ref([]);
    const pnsOptions = ref([]);
    onMounted(async () => {
      [kdoOptions.value, pnsOptions.value] = await Promise.all([
        props.kdo ? [] : fetchOptions('/kdo', { is_aktif: 1, tanpa_pemegang: 1 }),
        props.pns ? [] : fetchOptions('/pns', { status_kepegawaian: 'aktif' }),
      ]);
    });
    async function save() {
      const res = await form.submit((v) => api.post('/pemakaian', v), { success: 'Pemakai kendaraan ditautkan' });
      if (res) emit('saved', res.data);
    }
    return { ...form, kdoOptions, pnsOptions, save, today };
  },
  template: `<Modal title="Tautkan Pemakai Kendaraan" @close="$emit('close')">
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <form class="form" @submit.prevent="save" novalidate>
      <Field label="Kendaraan" name="kdo_id" :error="errors.kdo_id" required full>
        <input v-if="kdo" id="kdo_id" :value="kdo.nomor_polisi + ' · ' + kdo.merek + ' ' + (kdo.tipe || '')" disabled>
        <select v-else id="kdo_id" v-model.number="values.kdo_id"><option :value="null">Pilih kendaraan tanpa pemakai</option>
          <option v-for="k in kdoOptions" :key="k.id" :value="k.id">{{ k.nomor_polisi }} · {{ k.merek }} {{ k.tipe }}</option></select>
      </Field>
      <Field label="Pegawai pemakai" name="pns_id" :error="errors.pns_id" required full hint="Hanya PNS berstatus aktif">
        <input v-if="pns" id="pns_id" :value="pns.nama_pegawai" disabled>
        <select v-else id="pns_id" v-model.number="values.pns_id"><option :value="null">Pilih pegawai</option>
          <option v-for="p in pnsOptions" :key="p.id" :value="p.id">{{ p.nama_pegawai }} · {{ p.jabatan }} ({{ p.perangkat_daerah_singkatan || p.perangkat_daerah }})</option></select>
      </Field>
      <Field label="Tanggal mulai" name="tanggal_mulai" :error="errors.tanggal_mulai" required><input id="tanggal_mulai" type="date" v-model="values.tanggal_mulai" :max="today()"></Field>
      <Field label="Keperluan / keterangan" name="keterangan" :error="errors.keterangan" full><textarea id="keterangan" v-model="values.keterangan" rows="2"></textarea></Field>
      <footer class="field full"><button type="button" @click="$emit('close')">Batal</button>
        <button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Tautkan' }}</button></footer>
    </form>
  </Modal>`,
};

export const TutupPemakaianDialog = {
  components: { Modal, Field },
  props: { pemakaian: { type: Object, required: true } },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const form = useForm(schemas.pemakaianSelesai, { tanggal_selesai: today(), keterangan: '' });
    async function save() {
      const res = await form.submit((v) => api.post(`/pemakaian/${props.pemakaian.id}/selesai`, v), { success: 'Pemakaian ditutup' });
      if (res) emit('saved', res.data);
    }
    return { ...form, save, today, tanggal };
  },
  template: `<Modal title="Tutup Pemakaian Kendaraan" @close="$emit('close')">
    <p>Tutup pemakaian <b>{{ pemakaian.nomor_polisi }}</b> oleh <b>{{ pemakaian.pns_nama }}</b> yang berjalan sejak {{ tanggal(pemakaian.tanggal_mulai) }}?</p>
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <form class="form" @submit.prevent="save" novalidate>
      <Field label="Tanggal selesai" name="tanggal_selesai" :error="errors.tanggal_selesai" required>
        <input id="tanggal_selesai" type="date" v-model="values.tanggal_selesai" :min="pemakaian.tanggal_mulai" :max="today()"></Field>
      <Field label="Keterangan" name="keterangan" :error="errors.keterangan" full><textarea id="keterangan" v-model="values.keterangan" rows="2" placeholder="mis. mutasi, pensiun, kendaraan dikembalikan"></textarea></Field>
      <footer class="field full"><button type="button" @click="$emit('close')">Batal</button>
        <button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Tutup Pemakaian' }}</button></footer>
    </form>
  </Modal>`,
};

/** Catat perawatan baru (record kosong) atau ubah catatan yang ada. */
export const PerawatanDialog = {
  components: { Modal, Field, EnumSelect },
  props: { kdo: Object, record: Object },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const editing = !!props.record?.id;
    const form = useForm(schemas.perawatan, editing ? { ...props.record } : {
      kdo_id: props.kdo?.id ?? null, tanggal_servis: today(), jenis_perawatan: 'rutin', deskripsi: '', bengkel: '',
      biaya: null, kondisi_setelah: props.kdo?.kondisi ?? 'baik', jadwal_berikutnya: null,
    });
    const kdoOptions = ref([]);
    onMounted(async () => { if (!props.kdo) kdoOptions.value = await fetchOptions('/kdo', { is_aktif: 1 }); });
    const minJadwal = computed(() => form.values.tanggal_servis || today());
    async function save() {
      const res = await form.submit(
        (v) => (editing ? api.put(`/perawatan/${props.record.id}`, v) : api.post('/perawatan', v)),
        { success: editing ? 'Catatan perawatan diperbarui' : 'Perawatan dicatat' });
      if (res) emit('saved', res.data);
    }
    return { ...form, editing, kdoOptions, minJadwal, save, today };
  },
  template: `<Modal :title="editing ? 'Ubah Catatan Perawatan' : 'Catat Perawatan'" wide @close="$emit('close')">
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <form class="form" @submit.prevent="save" novalidate>
      <Field label="Kendaraan" name="kdo_id" :error="errors.kdo_id" required full>
        <input v-if="kdo" id="kdo_id" :value="kdo.nomor_polisi + ' · ' + kdo.merek + ' ' + (kdo.tipe || '')" disabled>
        <select v-else id="kdo_id" v-model.number="values.kdo_id"><option :value="null">Pilih kendaraan</option>
          <option v-for="k in kdoOptions" :key="k.id" :value="k.id">{{ k.nomor_polisi }} · {{ k.merek }} {{ k.tipe }}</option></select>
      </Field>
      <Field label="Tanggal servis" name="tanggal_servis" :error="errors.tanggal_servis" required><input id="tanggal_servis" type="date" v-model="values.tanggal_servis" :max="today()"></Field>
      <Field label="Jenis perawatan" name="jenis_perawatan" :error="errors.jenis_perawatan" required><EnumSelect id="jenis_perawatan" v-model="values.jenis_perawatan" group="jenis_perawatan" /></Field>
      <Field label="Bengkel" name="bengkel" :error="errors.bengkel"><input id="bengkel" v-model="values.bengkel"></Field>
      <Field label="Biaya (Rp)" name="biaya" :error="errors.biaya" required><input id="biaya" type="number" min="0" step="1" v-model="values.biaya"></Field>
      <Field label="Kondisi setelah servis" name="kondisi_setelah" :error="errors.kondisi_setelah" required hint="Memperbarui kondisi kendaraan bila ini catatan terbaru">
        <EnumSelect id="kondisi_setelah" v-model="values.kondisi_setelah" group="kondisi" /></Field>
      <Field label="Jadwal servis berikutnya" name="jadwal_berikutnya" :error="errors.jadwal_berikutnya"><input id="jadwal_berikutnya" type="date" v-model="values.jadwal_berikutnya" :min="minJadwal"></Field>
      <Field label="Deskripsi pekerjaan" name="deskripsi" :error="errors.deskripsi" full><textarea id="deskripsi" v-model="values.deskripsi" rows="2"></textarea></Field>
      <footer class="field full"><button type="button" @click="$emit('close')">Batal</button>
        <button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan' }}</button></footer>
    </form>
  </Modal>`,
};
