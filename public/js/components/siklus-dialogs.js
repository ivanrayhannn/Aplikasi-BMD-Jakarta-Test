// Dialog siklus aset: membuat pengajuan (pengadaan, penugasan, pengembalian, mutasi, disposal) dan form pengembalian aset.
import { ref, computed, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { store, isPegawai } from '../store.js';
import { schemas } from '../../lib/shared/validation.js';
import { today, label, ENUMS } from '../format.js';
import { fetchOptions } from './list.js';
import { Modal, Field, EnumSelect, useForm } from './ui.js';

const JUDUL = {
  pengadaan: 'Ajukan Pengadaan Kendaraan', penugasan: 'Ajukan Penugasan Pemegang', pengembalian: 'Ajukan Pengembalian Aset',
  mutasi: 'Ajukan Mutasi Aset', disposal: 'Ajukan Disposal Aset',
};

/** Pengajuan baru. `kdo` mengunci kendaraan bila dibuka dari detail kendaraan. */
export const AjukanDialog = {
  components: { Modal, Field, EnumSelect },
  props: { jenis: { type: String, required: true }, kdo: Object },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const form = useForm(schemas.pengajuan, {
      jenis: props.jenis, kdo_id: props.kdo?.id ?? null, pns_id: null, perangkat_daerah_id: null, alasan: '',
      lokasi_tujuan: '', jenis_kendaraan: null, jumlah: 1, spesifikasi: '', estimasi_biaya: null, metode: null, nilai_taksiran: null,
      tanggal_dibutuhkan: null,
    });
    const kdoOptions = ref([]);
    const pnsOptions = ref([]);
    const units = ref([]);
    const j = props.jenis;
    onMounted(async () => {
      try {
        const tasks = [];
        if (!props.kdo && j !== 'pengadaan' && !(j === 'penugasan' && isPegawai.value)) {
          // Penugasan: hanya kendaraan siaga. Disposal: tanpa pemegang. Pengembalian oleh pegawai: kendaraannya sendiri.
          const params = j === 'penugasan' ? { status_aset: 'siaga', is_aktif: 1 } : j === 'disposal' ? { tanpa_pemegang: 1, is_aktif: 1 } : { is_aktif: 1 };
          tasks.push(fetchOptions('/kdo', params).then((r) => (kdoOptions.value = j === 'pengembalian' ? r.filter((k) => k.pemegang_pns_id) : r)));
        }
        if ((j === 'penugasan' && !isPegawai.value) || j === 'mutasi') tasks.push(fetchOptions('/pns', { status_kepegawaian: 'aktif' }).then((r) => (pnsOptions.value = r)));
        if (j === 'pengadaan' || j === 'mutasi') tasks.push(fetchOptions('/perangkat-daerah', { is_aktif: 1 }).then((r) => (units.value = r)));
        await Promise.all(tasks);
      } catch (e) { form.state.message = e.message; }
    });
    async function save() {
      const res = await form.submit((v) => api.post('/pengajuan', v));
      if (res) emit('saved', res.data);
    }
    const butuhKdo = computed(() => ['pengembalian', 'mutasi', 'disposal'].includes(j));
    return { ...form, j, kdoOptions, pnsOptions, units, butuhKdo, save, isPegawai, store, judul: JUDUL[j], today, label };
  },
  template: `<Modal :title="judul" wide @close="$emit('close')">
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <p v-if="j !== 'pengembalian'" class="hint">Pengajuan ini perlu disetujui Approver sebelum diproses Pengelola Aset.</p>
    <p v-else class="hint">Pengembalian tidak memerlukan persetujuan. Pengelola Aset akan memeriksa unit dan menerbitkan berita acara.</p>
    <form class="form" @submit.prevent="save" novalidate>
      <Field v-if="j !== 'pengadaan'" label="Kendaraan" name="kdo_id" :error="errors.kdo_id" :required="butuhKdo" full
        :hint="j === 'penugasan' ? (isPegawai ? 'Kendaraan dipilihkan Pengelola Aset saat serah terima' : 'Opsional; hanya kendaraan berstatus Siaga') : ''">
        <input v-if="kdo" id="kdo_id" :value="kdo.nomor_polisi + ', ' + kdo.merek + ' ' + (kdo.tipe || '')" disabled>
        <input v-else-if="j === 'penugasan' && isPegawai" id="kdo_id" value="Dipilihkan Pengelola Aset" disabled>
        <select v-else id="kdo_id" v-model.number="values.kdo_id"><option :value="null">{{ butuhKdo ? 'Pilih kendaraan' : 'Belum ditentukan' }}</option>
          <option v-for="k in kdoOptions" :key="k.id" :value="k.id">{{ k.nomor_polisi }}, {{ k.merek }} {{ k.tipe }} ({{ k.perangkat_daerah_singkatan }})</option></select>
      </Field>

      <template v-if="j === 'penugasan'">
        <Field label="Pegawai pemohon" name="pns_id" :error="errors.pns_id" required full>
          <input v-if="isPegawai" id="pns_id" :value="store.user.nama" disabled>
          <select v-else id="pns_id" v-model.number="values.pns_id"><option :value="null">Pilih pegawai</option>
            <option v-for="p in pnsOptions" :key="p.id" :value="p.id">{{ p.nama_pegawai }}, {{ p.jabatan }} ({{ p.perangkat_daerah_singkatan }})</option></select>
        </Field>
        <Field label="Jenis kendaraan yang dibutuhkan" name="jenis_kendaraan" :error="errors.jenis_kendaraan"><EnumSelect id="jenis_kendaraan" v-model="values.jenis_kendaraan" group="jenis_kendaraan" /></Field>
        <Field label="Dibutuhkan mulai" name="tanggal_dibutuhkan" :error="errors.tanggal_dibutuhkan"><input id="tanggal_dibutuhkan" type="date" v-model="values.tanggal_dibutuhkan" :min="today()"></Field>
      </template>

      <template v-if="j === 'mutasi'">
        <Field label="Perangkat daerah tujuan" name="perangkat_daerah_id" :error="errors.perangkat_daerah_id" hint="Kosongkan bila unit tidak berubah">
          <select id="perangkat_daerah_id" v-model.number="values.perangkat_daerah_id"><option :value="null">Tidak berubah</option>
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.nama_dinas }}</option></select></Field>
        <Field label="Pemegang (custodian) baru" name="pns_id" :error="errors.pns_id" hint="Kosongkan bila pemegang tidak berubah">
          <select id="pns_id" v-model.number="values.pns_id"><option :value="null">Tidak berubah</option>
            <option v-for="p in pnsOptions" :key="p.id" :value="p.id">{{ p.nama_pegawai }} ({{ p.perangkat_daerah_singkatan }})</option></select></Field>
        <Field label="Lokasi tujuan" name="lokasi_tujuan" :error="errors.lokasi_tujuan" full hint="Mis. Pool kendaraan Balai Kota"><input id="lokasi_tujuan" v-model="values.lokasi_tujuan" maxlength="150"></Field>
      </template>

      <template v-if="j === 'disposal'">
        <Field label="Metode disposal" name="metode" :error="errors.metode" required><EnumSelect id="metode" v-model="values.metode" group="metode_disposal" /></Field>
        <Field label="Nilai taksiran (Rp)" name="nilai_taksiran" :error="errors.nilai_taksiran"><input id="nilai_taksiran" type="number" min="0" v-model="values.nilai_taksiran"></Field>
      </template>

      <template v-if="j === 'pengadaan'">
        <Field label="Unit pemohon" name="perangkat_daerah_id" :error="errors.perangkat_daerah_id" required full>
          <select id="perangkat_daerah_id" v-model.number="values.perangkat_daerah_id"><option :value="null">Pilih perangkat daerah</option>
            <option v-for="u in units" :key="u.id" :value="u.id">{{ u.nama_dinas }}</option></select></Field>
        <Field label="Jenis kendaraan" name="jenis_kendaraan" :error="errors.jenis_kendaraan" required><EnumSelect id="jenis_kendaraan" v-model="values.jenis_kendaraan" group="jenis_kendaraan" /></Field>
        <Field label="Jumlah unit" name="jumlah" :error="errors.jumlah" required><input id="jumlah" type="number" min="1" max="100" v-model="values.jumlah"></Field>
        <Field label="Estimasi biaya (Rp)" name="estimasi_biaya" :error="errors.estimasi_biaya"><input id="estimasi_biaya" type="number" min="0" v-model="values.estimasi_biaya"></Field>
        <Field label="Dibutuhkan paling lambat" name="tanggal_dibutuhkan" :error="errors.tanggal_dibutuhkan"><input id="tanggal_dibutuhkan" type="date" v-model="values.tanggal_dibutuhkan" :min="today()"></Field>
        <Field label="Spesifikasi" name="spesifikasi" :error="errors.spesifikasi" full><textarea id="spesifikasi" v-model="values.spesifikasi" rows="2"></textarea></Field>
      </template>

      <Field label="Alasan / kebutuhan" name="alasan" :error="errors.alasan" required full><textarea id="alasan" v-model="values.alasan" rows="3"></textarea></Field>
      <footer class="field full"><button type="button" @click="$emit('close')">Batal</button>
        <button class="primary" :disabled="state.busy">{{ state.busy ? 'Mengirim…' : 'Kirim pengajuan' }}</button></footer>
    </form>
  </Modal>`,
};

/** Form pengembalian aset: data pengembalian, pemeriksaan unit, dan serah terima (BR-24). */
export const PengembalianDialog = {
  components: { Modal, Field, EnumSelect },
  props: { kdo: { type: Object, required: true }, pengajuan: Object },
  emits: ['close', 'saved'],
  setup(props, { emit }) {
    const form = useForm(schemas.pengembalian, {
      kdo_id: props.kdo.id, pengajuan_id: props.pengajuan?.id ?? null, tanggal_kembali: today(),
      alasan: props.pengajuan?.alasan ?? '', kondisi_hasil_cek: props.kdo.kondisi ?? 'baik', kilometer: null,
      kelengkapan: ['stnk', 'kunci'], catatan_pemeriksaan: '', diterima_oleh: store.user?.nama ?? '',
    });
    const toggle = (v) => {
      const list = form.values.kelengkapan;
      form.values.kelengkapan = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    };
    async function save() {
      const res = await form.submit((v) => api.post('/pengembalian', v));
      if (res) emit('saved', res.data);
    }
    return { ...form, toggle, save, today, ENUMS, label };
  },
  template: `<Modal title="Pengembalian Aset" wide @close="$emit('close')">
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>
    <form class="form" @submit.prevent="save" novalidate>
      <h3 class="field full form-section">1. Data pengembalian</h3>
      <Field label="Kendaraan" name="kdo_ro" full><input id="kdo_ro" :value="kdo.nomor_polisi + ', ' + kdo.merek + ' ' + (kdo.tipe || '')" disabled></Field>
      <Field label="Dikembalikan oleh" name="pemegang_ro"><input id="pemegang_ro" :value="kdo.pemegang_nama || '-'" disabled></Field>
      <Field label="Tanggal kembali" name="tanggal_kembali" :error="errors.tanggal_kembali" required><input id="tanggal_kembali" type="date" v-model="values.tanggal_kembali" :max="today()"></Field>
      <Field label="Alasan pengembalian" name="alasan" :error="errors.alasan" required full><input id="alasan" v-model="values.alasan" maxlength="500" placeholder="mis. mutasi pegawai, pensiun, tugas selesai"></Field>

      <h3 class="field full form-section">2. Pengecekan unit</h3>
      <Field label="Kondisi hasil pemeriksaan" name="kondisi_hasil_cek" :error="errors.kondisi_hasil_cek" required hint="Menjadi kondisi kendaraan; Rusak Berat membuat status aset Rusak">
        <EnumSelect id="kondisi_hasil_cek" v-model="values.kondisi_hasil_cek" group="kondisi" /></Field>
      <Field label="Kilometer (odometer)" name="kilometer" :error="errors.kilometer"><input id="kilometer" type="number" min="0" v-model="values.kilometer"></Field>
      <fieldset class="field full checks"><legend>Kelengkapan yang diterima</legend>
        <label v-for="o in ENUMS.kelengkapan" :key="o.value" class="check"><input type="checkbox" :checked="values.kelengkapan.includes(o.value)" @change="toggle(o.value)"> {{ o.label }}</label>
        <div v-if="errors.kelengkapan" class="field-error">{{ errors.kelengkapan }}</div>
      </fieldset>
      <Field label="Catatan pemeriksaan" name="catatan_pemeriksaan" :error="errors.catatan_pemeriksaan" full><textarea id="catatan_pemeriksaan" v-model="values.catatan_pemeriksaan" rows="2" placeholder="mis. lecet bemper kanan, ban serep kempis"></textarea></Field>

      <h3 class="field full form-section">3. Serah terima</h3>
      <Field label="Diterima oleh" name="diterima_oleh" :error="errors.diterima_oleh" required full hint="Nama dan jabatan petugas yang menerima; tercantum di berita acara">
        <input id="diterima_oleh" v-model="values.diterima_oleh" maxlength="150"></Field>
      <footer class="field full"><button type="button" @click="$emit('close')">Batal</button>
        <button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Terima & terbitkan berita acara' }}</button></footer>
    </form>
  </Modal>`,
};
