// Siklus aset: daftar dan detail pengajuan (approval + proses), berita acara (daftar + cetak), dan beranda pegawai.
import { ref, computed, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { store, isAdmin, isApprover, isPegawai, notify } from '../store.js';
import { route, navigate } from '../router.js';
import { label, tone, tanggal, waktu, rupiah, kendaraan, today, ENUMS } from '../format.js';
import { schemas } from '../../lib/shared/validation.js';
import { useList, fetchOptions } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, Field, EnumSelect, ConfirmDialog, useForm } from '../components/ui.js';
import { AjukanDialog, PengembalianDialog } from '../components/siklus-dialogs.js';

const HALAMAN = {
  pengadaan: ['Pengadaan', 'Permintaan kendaraan baru: approval, PR/PO, penerimaan unit, registrasi aset'],
  mutasi: ['Mutasi Aset', 'Pindah perangkat daerah, lokasi, atau pemegang dengan approval dan berita acara'],
  disposal: ['Disposal Aset', 'Penjualan, lelang, atau scrap dengan approval dan nilai jual'],
  '': ['Pengajuan & Persetujuan', 'Semua pengajuan siklus aset dan statusnya'],
};

/** Daftar pengajuan. Jenis dikunci oleh meta rute (#/pengadaan, #/mutasi, #/disposal) atau bebas di #/pengajuan. */
export const PengajuanList = {
  components: { Badge, EmptyState, PageHeader, Pager, EnumSelect, AjukanDialog },
  setup() {
    const fixed = route.match?.meta.jenis ?? '';
    const list = useList('/pengajuan', { q: '', jenis: fixed, status: isApprover.value && !fixed ? 'diajukan' : '' });
    const dialog = ref(null);
    const [judul, sub] = isPegawai.value ? ['Pengajuan Saya', 'Pengajuan kendaraan dan pengembalian yang Anda kirim'] : HALAMAN[fixed];
    // Jenis yang boleh diajukan peran ini dari halaman ini.
    const bisaAjukan = computed(() => (isPegawai.value ? ['penugasan', 'pengembalian'] : isAdmin.value ? (fixed ? [fixed] : ['pengadaan', 'mutasi', 'disposal']) : []));
    function saved(pg) { dialog.value = null; notify(`Pengajuan ${pg.nomor} terkirim`); navigate(`/pengajuan/${pg.id}`); }
    return { ...list, fixed, judul, sub, dialog, bisaAjukan, saved, label, tone, tanggal, waktu, kendaraan, isApprover, ENUMS };
  },
  template: `<div>
    <PageHeader :title="judul" :subtitle="sub">
      <button v-for="j in bisaAjukan" :key="j" class="primary" @click="dialog = j">+ Ajukan {{ label('jenis_pengajuan', j) }}</button>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor, alasan, nomor polisi, atau pegawai…"></label>
        <label v-if="!fixed" class="filter"><span>Jenis</span><EnumSelect v-model="filters.jenis" group="jenis_pengajuan" placeholder="Semua jenis" /></label>
        <label class="filter"><span>Status</span><select v-model="filters.status"><option value="">Semua status</option><option value="terbuka">Masih berjalan</option>
          <option v-for="o in ENUMS.status_pengajuan" :key="o.value" :value="o.value">{{ o.label }}</option></select></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Nomor</th><th v-if="!fixed">Jenis</th><th>Kendaraan / Unit</th><th>Pegawai</th><th>Diajukan</th><th>Status</th></tr></thead>
        <tbody><tr v-for="p in rows" :key="p.id">
          <td data-label="Nomor"><a :href="'#/pengajuan/' + p.id" class="code">{{ p.nomor }}</a><span class="sub">{{ p.alasan }}</span></td>
          <td v-if="!fixed" data-label="Jenis">{{ label('jenis_pengajuan', p.jenis) }}</td>
          <td data-label="Kendaraan / Unit"><Plate v-if="p.nomor_polisi" :nopol="p.nomor_polisi" /><span class="sub">{{ p.nomor_polisi ? kendaraan(p) : '' }}</span>
            <span v-if="p.perangkat_daerah_singkatan" class="sub">{{ p.jenis === 'mutasi' ? 'Tujuan: ' : '' }}{{ p.perangkat_daerah_singkatan }}</span>
            <span v-if="p.jenis === 'pengadaan'" class="sub">{{ p.detail.jumlah }} unit {{ label('jenis_kendaraan', p.detail.jenis_kendaraan) }}</span></td>
          <td data-label="Pegawai">{{ p.pns_nama || '-' }}</td>
          <td data-label="Diajukan">{{ tanggal(p.diajukan_pada) }}<span class="sub">{{ p.diajukan_oleh_nama }}</span></td>
          <td data-label="Status"><Badge :tone="tone('status_pengajuan', p.status)">{{ label('status_pengajuan', p.status) }}</Badge></td>
        </tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada pengajuan yang cocok' : 'Belum ada pengajuan'"
        :hint="isApprover && filters.status === 'diajukan' ? 'Tidak ada pengajuan yang menunggu keputusan Anda.' : 'Pengajuan baru muncul di sini.'" />
      <Pager :meta="meta" @page="goTo" />
    </div>
    <AjukanDialog v-if="dialog" :jenis="dialog" @close="dialog = null" @saved="saved" />
  </div>`,
};

/** Form proses admin sesuai jenis dan tahap pengajuan. */
const ProsesForm = {
  components: { Field, EnumSelect },
  props: { pg: { type: Object, required: true } },
  emits: ['done'],
  setup(props, { emit }) {
    const pg = props.pg;
    const tahap = pg.jenis === 'pengadaan' ? (pg.status === 'disetujui' ? 'po' : 'penerimaan') : pg.jenis;
    const schema = { penugasan: schemas.prosesPenugasan, mutasi: schemas.prosesMutasi, disposal: schemas.prosesDisposal, po: schemas.prosesPo, penerimaan: schemas.prosesPenerimaan }[tahap];
    const nama = store.user?.nama ?? '';
    const form = useForm(schema, {
      kdo_id: pg.kdo_id, tanggal: today(), diserahkan_oleh: tahap === 'penerimaan' ? pg.detail.vendor ?? '' : nama, diterima_oleh: '', catatan: '',
      nilai_jual: null, nomor_dokumen: '', pembeli: '', nomor_pr: '', nomor_po: '', vendor: '', tanggal_po: today(), nilai_po: pg.detail.estimasi_biaya ?? null,
      tanggal_terima: today(), kelengkapan: ['stnk', 'kunci', 'buku_servis'],
    });
    const kdoOptions = ref([]);
    onMounted(async () => { if (tahap === 'penugasan' && !pg.kdo_id) kdoOptions.value = await fetchOptions('/kdo', { status_aset: 'siaga', is_aktif: 1 }); });
    const toggle = (v) => { const l = form.values.kelengkapan; form.values.kelengkapan = l.includes(v) ? l.filter((x) => x !== v) : [...l, v]; };
    const TOMBOL = { penugasan: 'Serahkan & terbitkan BAST', mutasi: 'Proses mutasi & terbitkan BA', disposal: 'Hapuskan aset & terbitkan BA', po: 'Simpan PR/PO', penerimaan: 'Terima unit & terbitkan BA' };
    async function save() {
      const res = await form.submit((v) => api.post(`/pengajuan/${pg.id}/proses`, v), { success: 'Pengajuan diproses' });
      if (res) emit('done');
    }
    return { ...form, tahap, kdoOptions, toggle, save, tombol: TOMBOL[tahap], today, ENUMS };
  },
  template: `<form class="form" @submit.prevent="save" novalidate>
    <div v-if="state.message" class="alert error field full" role="alert">{{ state.message }}</div>
    <template v-if="tahap === 'penugasan'">
      <Field label="Kendaraan yang diserahkan" name="kdo_id" :error="errors.kdo_id" required full>
        <input v-if="pg.kdo_id" id="kdo_id" :value="pg.nomor_polisi + ', ' + pg.merek + ' ' + (pg.tipe || '')" disabled>
        <select v-else id="kdo_id" v-model.number="values.kdo_id"><option :value="null">Pilih kendaraan berstatus Siaga</option>
          <option v-for="k in kdoOptions" :key="k.id" :value="k.id">{{ k.nomor_polisi }}, {{ k.merek }} {{ k.tipe }} ({{ k.perangkat_daerah_singkatan }})</option></select></Field>
      <Field label="Tanggal serah terima" name="tanggal" :error="errors.tanggal" required><input id="tanggal" type="date" v-model="values.tanggal" :max="today()"></Field>
      <Field label="Diserahkan oleh" name="diserahkan_oleh" :error="errors.diserahkan_oleh" required><input id="diserahkan_oleh" v-model="values.diserahkan_oleh"></Field>
    </template>
    <template v-if="tahap === 'mutasi'">
      <Field label="Tanggal mutasi" name="tanggal" :error="errors.tanggal" required><input id="tanggal" type="date" v-model="values.tanggal" :max="today()"></Field>
      <Field label="Diserahkan oleh" name="diserahkan_oleh" :error="errors.diserahkan_oleh" required hint="Pejabat unit asal"><input id="diserahkan_oleh" v-model="values.diserahkan_oleh"></Field>
      <Field label="Diterima oleh" name="diterima_oleh" :error="errors.diterima_oleh" required hint="Pejabat unit tujuan"><input id="diterima_oleh" v-model="values.diterima_oleh"></Field>
    </template>
    <template v-if="tahap === 'disposal'">
      <Field label="Tanggal pelaksanaan" name="tanggal" :error="errors.tanggal" required><input id="tanggal" type="date" v-model="values.tanggal" :max="today()"></Field>
      <Field label="Nilai jual (Rp)" name="nilai_jual" :error="errors.nilai_jual" required hint="Isi 0 untuk scrap tanpa nilai"><input id="nilai_jual" type="number" min="0" v-model="values.nilai_jual"></Field>
      <Field label="Nomor dokumen" name="nomor_dokumen" :error="errors.nomor_dokumen" required hint="Risalah lelang / SK penghapusan"><input id="nomor_dokumen" v-model="values.nomor_dokumen"></Field>
      <Field label="Pembeli / pemenang lelang" name="pembeli" :error="errors.pembeli"><input id="pembeli" v-model="values.pembeli"></Field>
    </template>
    <template v-if="tahap === 'po'">
      <Field label="Nomor PR" name="nomor_pr" :error="errors.nomor_pr" required><input id="nomor_pr" v-model="values.nomor_pr"></Field>
      <Field label="Nomor PO" name="nomor_po" :error="errors.nomor_po" required><input id="nomor_po" v-model="values.nomor_po"></Field>
      <Field label="Vendor" name="vendor" :error="errors.vendor" required><input id="vendor" v-model="values.vendor"></Field>
      <Field label="Tanggal PO" name="tanggal_po" :error="errors.tanggal_po" required><input id="tanggal_po" type="date" v-model="values.tanggal_po" :max="today()"></Field>
      <Field label="Nilai PO (Rp)" name="nilai_po" :error="errors.nilai_po" required><input id="nilai_po" type="number" min="0" v-model="values.nilai_po"></Field>
    </template>
    <template v-if="tahap === 'penerimaan'">
      <Field label="Tanggal terima" name="tanggal_terima" :error="errors.tanggal_terima" required><input id="tanggal_terima" type="date" v-model="values.tanggal_terima" :max="today()"></Field>
      <Field label="Diserahkan oleh (vendor)" name="diserahkan_oleh" :error="errors.diserahkan_oleh" required><input id="diserahkan_oleh" v-model="values.diserahkan_oleh"></Field>
      <fieldset class="field full checks"><legend>Kelengkapan yang diterima</legend>
        <label v-for="o in ENUMS.kelengkapan" :key="o.value" class="check"><input type="checkbox" :checked="values.kelengkapan.includes(o.value)" @change="toggle(o.value)"> {{ o.label }}</label></fieldset>
    </template>
    <Field v-if="tahap !== 'po'" label="Catatan" name="catatan" :error="errors.catatan" full><textarea id="catatan" v-model="values.catatan" rows="2"></textarea></Field>
    <footer class="field full"><button class="primary" :disabled="state.busy">{{ state.busy ? 'Memproses…' : tombol }}</button></footer>
  </form>`,
};

/** Detail pengajuan: rincian, alur status, keputusan Approver, proses Pengelola Aset, dan berita acara. */
export const PengajuanDetail = {
  components: { Badge, PageHeader, Field, ConfirmDialog, ProsesForm, PengembalianDialog },
  setup() {
    const pg = ref(null);
    const error = ref('');
    const catatan = ref('');
    const busy = ref(false);
    const dialog = ref(null);
    const kdoKembali = ref(null);
    async function load() {
      try { pg.value = (await api.get(`/pengajuan/${route.params.id}`)).data; } catch (e) { error.value = e.message; }
    }
    onMounted(load);
    async function putuskan(setuju) {
      busy.value = true;
      try {
        await api.post(`/pengajuan/${pg.value.id}/${setuju ? 'setujui' : 'tolak'}`, { catatan: catatan.value || null });
        notify(setuju ? 'Pengajuan disetujui' : 'Pengajuan ditolak');
        catatan.value = '';
        await load();
      } catch (e) { notify(e.details?.catatan ?? e.message, 'error'); } finally { busy.value = false; }
    }
    const batal = () => api.post(`/pengajuan/${pg.value.id}/batal`);
    async function bukaPengembalian() {
      try { kdoKembali.value = (await api.get(`/kdo/${pg.value.kdo_id}`)).data; dialog.value = 'kembali'; } catch (e) { notify(e.message, 'error'); }
    }
    function kembaliSelesai(r) { dialog.value = null; notify(`Pengembalian tercatat, ${r.berita_acara_nomor}`); load(); }

    const terbuka = computed(() => pg.value && ['disetujui', 'dipesan', 'diterima'].includes(pg.value.status));
    const bisaPutus = computed(() => isApprover.value && pg.value?.status === 'diajukan' && pg.value.diajukan_oleh !== store.user?.id);
    const bisaBatal = computed(() => pg.value && ['diajukan', 'disetujui'].includes(pg.value.status) && (isAdmin.value || pg.value.diajukan_oleh === store.user?.id));
    // Rincian khusus per jenis, ditampilkan sebagai pasangan label → nilai.
    const rincian = computed(() => {
      const p = pg.value; if (!p) return [];
      const d = p.detail;
      const rows = {
        pengadaan: [['Unit pemohon', p.perangkat_daerah], ['Jenis kendaraan', label('jenis_kendaraan', d.jenis_kendaraan)], ['Jumlah', `${d.jumlah} unit`],
          ['Spesifikasi', d.spesifikasi], ['Estimasi biaya', rupiah(d.estimasi_biaya)], ['Dibutuhkan', tanggal(d.tanggal_dibutuhkan)],
          ['Nomor PR', d.nomor_pr], ['Nomor PO', d.nomor_po], ['Vendor', d.vendor], ['Nilai PO', d.nilai_po ? rupiah(d.nilai_po) : null], ['Diterima', d.tanggal_terima ? tanggal(d.tanggal_terima) : null]],
        penugasan: [['Pegawai pemohon', p.pns_nama], ['Unit pegawai', p.perangkat_daerah], ['Jenis dibutuhkan', label('jenis_kendaraan', d.jenis_kendaraan)], ['Dibutuhkan mulai', tanggal(d.tanggal_dibutuhkan)]],
        pengembalian: [['Pemegang', p.pns_nama], ['Unit', p.perangkat_daerah]],
        mutasi: [['Unit tujuan', p.perangkat_daerah || 'Tidak berubah'], ['Pemegang baru', p.pns_nama || 'Tidak berubah'], ['Lokasi tujuan', d.lokasi_tujuan || 'Tidak berubah'], ['Lokasi asal', d.lokasi_asal]],
        disposal: [['Metode', label('metode_disposal', d.metode)], ['Nilai buku', rupiah(d.nilai_buku)], ['Nilai taksiran', rupiah(d.nilai_taksiran)],
          ['Nilai jual', d.nilai_jual != null ? rupiah(d.nilai_jual) : null], ['Nomor dokumen', d.nomor_dokumen], ['Pembeli', d.pembeli]],
      }[p.jenis] ?? [];
      return rows.filter(([, v]) => v && v !== '-');
    });
    return { pg, error, catatan, busy, dialog, kdoKembali, load, putuskan, batal, bukaPengembalian, kembaliSelesai, terbuka, bisaPutus, bisaBatal, rincian,
      isAdmin, label, tone, tanggal, waktu, kendaraan, navigate };
  },
  template: `<div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!pg && !error" />
    <template v-if="pg">
      <PageHeader :title="pg.nomor" :subtitle="label('jenis_pengajuan', pg.jenis)" back="#/pengajuan" back-label="Pengajuan">
        <template #badges> <Badge :tone="tone('status_pengajuan', pg.status)">{{ label('status_pengajuan', pg.status) }}</Badge></template>
        <button v-if="bisaBatal" class="danger" @click="dialog = 'batal'">Batalkan</button>
      </PageHeader>

      <div class="grid two">
        <div class="card"><h2>Rincian</h2><dl class="kv">
          <template v-if="pg.nomor_polisi"><dt>Kendaraan</dt><dd><a :href="'#/kdo/' + pg.kdo_id"><Plate :nopol="pg.nomor_polisi" /></a><span class="sub">{{ kendaraan(pg) }}</span></dd></template>
          <template v-for="[k, v] in rincian" :key="k"><dt>{{ k }}</dt><dd>{{ v }}</dd></template>
          <dt>Alasan</dt><dd>{{ pg.alasan }}</dd>
        </dl>
          <template v-if="pg.kendaraan_teregistrasi.length"><h3>Aset teregistrasi</h3>
            <p v-for="k in pg.kendaraan_teregistrasi" :key="k.id"><a :href="'#/kdo/' + k.id"><Plate :nopol="k.nomor_polisi" /></a> {{ kendaraan(k) }}</p></template>
        </div>
        <div class="card"><h2>Alur</h2>
          <ol class="timeline">
            <li class="done"><b>Diajukan</b><span class="sub">{{ waktu(pg.diajukan_pada) }}, {{ pg.diajukan_oleh_nama || '-' }}</span></li>
            <li :class="pg.diputus_pada || pg.jenis === 'pengembalian' ? (pg.status === 'ditolak' ? 'bad' : 'done') : 'todo'">
              <b>{{ pg.status === 'ditolak' ? 'Ditolak' : pg.jenis === 'pengembalian' ? 'Tanpa persetujuan' : 'Persetujuan Approver' }}</b>
              <span class="sub">{{ pg.diputus_pada ? waktu(pg.diputus_pada) + ', ' + pg.diputus_oleh_nama : pg.jenis === 'pengembalian' ? pg.catatan_keputusan : 'Menunggu keputusan' }}</span>
              <span v-if="pg.catatan_keputusan && pg.diputus_pada" class="sub">"{{ pg.catatan_keputusan }}"</span></li>
            <template v-if="pg.jenis === 'pengadaan'">
              <li :class="pg.detail.nomor_po ? 'done' : 'todo'"><b>PR/PO terbit</b><span class="sub">{{ pg.detail.nomor_po ? pg.detail.nomor_po + ', ' + tanggal(pg.detail.tanggal_po) : 'Belum' }}</span></li>
              <li :class="pg.detail.tanggal_terima ? 'done' : 'todo'"><b>Penerimaan unit</b><span class="sub">{{ pg.detail.tanggal_terima ? tanggal(pg.detail.tanggal_terima) : 'Belum' }}</span></li>
            </template>
            <li :class="pg.status === 'selesai' ? 'done' : pg.status === 'dibatalkan' ? 'bad' : 'todo'">
              <b>{{ pg.status === 'dibatalkan' ? 'Dibatalkan' : pg.jenis === 'pengadaan' ? 'Registrasi aset' : 'Diproses & berita acara' }}</b>
              <span class="sub">{{ pg.diselesaikan_pada ? waktu(pg.diselesaikan_pada) + ', ' + pg.diselesaikan_oleh_nama : pg.status === 'dibatalkan' ? waktu(pg.updated_at) : 'Belum' }}</span></li>
          </ol>
          <template v-if="pg.berita_acara.length"><h3>Berita acara</h3>
            <p v-for="b in pg.berita_acara" :key="b.id"><a :href="'#/berita-acara/' + b.id" class="code">{{ b.nomor }}</a> <span class="sub">{{ label('jenis_berita_acara', b.jenis) }}, {{ tanggal(b.tanggal) }}</span></p></template>
        </div>
      </div>

      <div v-if="bisaPutus" class="card action-card"><h2>Keputusan Approver</h2>
        <div class="form"><div class="field full"><label for="catatan">Catatan <span class="sub-inline">wajib bila menolak</span></label>
          <textarea id="catatan" v-model="catatan" rows="2"></textarea></div>
          <footer class="field full"><button class="danger" :disabled="busy" @click="putuskan(false)">Tolak</button>
            <button class="primary" :disabled="busy" @click="putuskan(true)">Setujui</button></footer></div>
      </div>
      <div v-if="isAdmin && terbuka" class="card action-card">
        <h2>{{ pg.jenis === 'pengembalian' ? 'Pengembalian aset' : pg.status === 'diterima' ? 'Registrasi aset' : 'Proses Pengelola Aset' }}</h2>
        <p v-if="pg.jenis === 'pengembalian'" class="actions"><button class="primary" @click="bukaPengembalian">Isi form pengembalian & pengecekan unit</button></p>
        <p v-else-if="pg.status === 'diterima'" class="actions">
          <a class="btn primary" :href="'#/kdo/baru?pengajuan=' + pg.id + '&jenis_kendaraan=' + pg.detail.jenis_kendaraan">Registrasi aset ({{ pg.kendaraan_teregistrasi.length + 1 }} dari {{ pg.detail.jumlah }})</a></p>
        <ProsesForm v-else :pg="pg" @done="load" />
      </div>
      <p v-if="pg.status === 'diajukan' && !bisaPutus && isApprover" class="hint">Anda tidak dapat memutus pengajuan yang Anda ajukan sendiri.</p>

      <ConfirmDialog v-if="dialog === 'batal'" title="Batalkan Pengajuan" confirm-label="Batalkan pengajuan" :action="batal" @close="dialog = null" @done="dialog = null; load()">
        Batalkan pengajuan <b>{{ pg.nomor }}</b>? Pengajuan yang dibatalkan tidak dapat diproses lagi.
      </ConfirmDialog>
      <PengembalianDialog v-if="dialog === 'kembali'" :kdo="kdoKembali" :pengajuan="pg" @close="dialog = null" @saved="kembaliSelesai" />
    </template>
  </div>`,
};

export const BeritaAcaraList = {
  components: { EmptyState, PageHeader, Pager, EnumSelect },
  setup() {
    const list = useList('/berita-acara', { q: '', jenis: '' });
    return { ...list, label, tanggal, kendaraan };
  },
  template: `<div>
    <PageHeader title="Berita Acara" subtitle="Bukti serah terima, pengembalian, mutasi, penghapusan, dan penerimaan barang" />
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor, pihak, atau nomor polisi…"></label>
        <label class="filter"><span>Jenis</span><EnumSelect v-model="filters.jenis" group="jenis_berita_acara" placeholder="Semua jenis" /></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Nomor</th><th>Jenis</th><th>Tanggal</th><th>Kendaraan</th><th>Pihak pertama</th><th>Pihak kedua</th></tr></thead>
        <tbody><tr v-for="b in rows" :key="b.id">
          <td data-label="Nomor"><a :href="'#/berita-acara/' + b.id" class="code">{{ b.nomor }}</a><span v-if="b.pengajuan_nomor" class="sub">{{ b.pengajuan_nomor }}</span></td>
          <td data-label="Jenis">{{ label('jenis_berita_acara', b.jenis) }}</td><td data-label="Tanggal">{{ tanggal(b.tanggal) }}</td>
          <td data-label="Kendaraan"><Plate v-if="b.nomor_polisi" :nopol="b.nomor_polisi" /><template v-else>-</template></td>
          <td data-label="Pihak pertama">{{ b.pihak_pertama }}</td><td data-label="Pihak kedua">{{ b.pihak_kedua }}</td></tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" title="Belum ada berita acara" hint="Berita acara terbit otomatis saat serah terima, pengembalian, mutasi, disposal, atau penerimaan barang." />
      <Pager :meta="meta" @page="goTo" />
    </div>
  </div>`,
};

/** Berita acara siap cetak dengan kop instansi dan kolom tanda tangan. */
export const BeritaAcaraPrint = {
  components: { PageHeader },
  setup() {
    const ba = ref(null);
    const error = ref('');
    onMounted(async () => { try { ba.value = (await api.get(`/berita-acara/${route.params.id}`)).data; } catch (e) { error.value = e.message; } });
    const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hari = (d) => HARI[new Date(`${d}T00:00:00`).getDay()];
    return { ba, error, store, hari, tanggal, print: () => window.print() };
  },
  template: `<div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!ba && !error" />
    <template v-if="ba">
      <PageHeader class="no-print" :title="ba.nomor" :subtitle="ba.jenis_label" back="#/berita-acara" back-label="Berita Acara">
        <button class="primary" @click="print">Cetak</button>
      </PageHeader>
      <article class="card ba-sheet">
        <header class="ba-kop">
          <img v-if="store.settings?.logo_url" :src="store.settings.logo_url" alt="" class="ba-logo">
          <div><b>{{ store.settings?.nama_instansi }}</b><span>{{ store.settings?.alamat }}</span></div>
        </header>
        <h2 class="ba-title">BERITA ACARA {{ ba.jenis_label.toUpperCase() }}</h2>
        <p class="ba-nomor">Nomor: {{ ba.nomor }}</p>
        <p>Pada hari ini, {{ hari(ba.tanggal) }} tanggal {{ tanggal(ba.tanggal) }}, yang bertanda tangan di bawah ini:</p>
        <dl class="kv ba-pihak"><dt>Pihak Pertama</dt><dd>{{ ba.pihak_pertama }}</dd><dt>Pihak Kedua</dt><dd>{{ ba.pihak_kedua }}</dd></dl>
        <p>{{ ba.uraian }}</p>
        <table v-if="ba.nomor_polisi" class="report-table"><tbody>
          <tr><th>Nomor polisi</th><td>{{ ba.nomor_polisi }}</td><th>Merek / tipe</th><td>{{ ba.merek }} {{ ba.tipe }}</td></tr>
          <tr><th>Nomor rangka</th><td>{{ ba.nomor_rangka }}</td><th>Nomor mesin</th><td>{{ ba.nomor_mesin || '-' }}</td></tr>
          <tr><th>Tahun</th><td>{{ ba.tahun_produksi }}</td><th>Kode barang aset</th><td>{{ ba.kode_barang_aset || '-' }}</td></tr>
        </tbody></table>
        <p>Demikian berita acara ini dibuat untuk dipergunakan sebagaimana mestinya.<template v-if="ba.pengajuan_nomor"> Dasar: pengajuan {{ ba.pengajuan_nomor }}.</template></p>
        <div class="ba-ttd">
          <div><span>Pihak Pertama</span><b>{{ ba.pihak_pertama }}</b></div>
          <div><span>Pihak Kedua</span><b>{{ ba.pihak_kedua }}</b></div>
        </div>
      </article>
    </template>
  </div>`,
};

/** Beranda peran Pegawai: kendaraan yang dipegang dan pengajuan miliknya. */
export const PegawaiHome = {
  components: { Badge, EmptyState, PageHeader, AjukanDialog },
  setup() {
    const kdo = ref(null);
    const pengajuan = ref([]);
    const error = ref('');
    const dialog = ref(null);
    async function load() {
      try {
        const [k, p] = await Promise.all([api.get('/kdo'), api.get('/pengajuan', { per_page: 5 })]);
        kdo.value = k.data; pengajuan.value = p.data;
      } catch (e) { error.value = e.message; }
    }
    onMounted(load);
    function saved(pg) { dialog.value = null; notify(`Pengajuan ${pg.nomor} terkirim`); navigate(`/pengajuan/${pg.id}`); }
    return { kdo, pengajuan, error, dialog, saved, store, label, tone, tanggal, kendaraan };
  },
  template: `<div>
    <PageHeader :title="'Halo, ' + store.user.nama" subtitle="Kendaraan dinas yang Anda pegang dan pengajuan Anda">
      <button class="primary" @click="dialog = { jenis: 'penugasan' }">+ Ajukan Kendaraan</button>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!kdo && !error" />
    <template v-if="kdo">
      <section class="card"><h2>Kendaraan Saya</h2>
        <ul class="vehicle-list"><li v-for="k in kdo" :key="k.id">
          <Plate :nopol="k.nomor_polisi" />
          <span><b>{{ kendaraan(k) }}</b><span class="sub">{{ k.perangkat_daerah }}, {{ k.lokasi || '-' }}</span></span>
          <Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge>
          <button class="small" @click="dialog = { jenis: 'pengembalian', kdo: k }">Ajukan Pengembalian</button>
        </li></ul>
        <EmptyState v-if="!kdo.length" title="Anda belum memegang kendaraan dinas" hint="Ajukan kendaraan bila dibutuhkan untuk tugas Anda." />
      </section>
      <section class="card"><div class="card-head"><h2>Pengajuan Terakhir</h2><a href="#/pengajuan">Semua pengajuan</a></div>
        <ul class="vehicle-list"><li v-for="p in pengajuan" :key="p.id">
          <a :href="'#/pengajuan/' + p.id" class="code">{{ p.nomor }}</a>
          <span>{{ label('jenis_pengajuan', p.jenis) }}<span class="sub">{{ tanggal(p.diajukan_pada) }}</span></span>
          <Badge :tone="tone('status_pengajuan', p.status)">{{ label('status_pengajuan', p.status) }}</Badge></li></ul>
        <EmptyState v-if="!pengajuan.length" title="Belum ada pengajuan" />
      </section>
    </template>
    <AjukanDialog v-if="dialog" :jenis="dialog.jenis" :kdo="dialog.kdo" @close="dialog = null" @saved="saved" />
  </div>`,
};
