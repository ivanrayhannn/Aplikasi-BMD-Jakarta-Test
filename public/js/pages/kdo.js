// Fitur 02 & 08 (Daftar Kendaraan Dinas): cari & saring, detail lengkap (pemakaian + perawatan), form berkelompok, hapus.
import { ref, computed, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { isAdmin, store } from '../store.js';
import { navigate, route } from '../router.js';
import { label, tone, tanggal, rupiah, angka, jatuhTempo, kendaraan, today, STATUS_JADWAL_LABEL } from '../format.js';
import { schemas } from '../../lib/shared/validation.js';
import { useList, fetchOptions } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, Field, EnumSelect, ConfirmDialog, useForm } from '../components/ui.js';
import { TautkanDialog, TutupPemakaianDialog, PerawatanDialog } from '../components/dialogs.js';

export const KdoList = {
  components: { Badge, EmptyState, PageHeader, Pager, EnumSelect },
  setup() {
    const units = ref([]);
    onMounted(async () => (units.value = await fetchOptions('/perangkat-daerah')));
    const list = useList('/kdo', { q: '', kondisi: '', jenis_kendaraan: '', perangkat_daerah_id: '', is_aktif: '1', tanpa_pemegang: '' });
    return { ...list, units, isAdmin, label, tone, kendaraan };
  },
  template: `<div>
    <PageHeader title="Kendaraan Dinas" :subtitle="meta ? meta.total + ' kendaraan ditemukan' : ''">
      <a v-if="isAdmin" class="btn primary" href="#/kdo/baru">+ Tambah Kendaraan</a>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor polisi, merek, tipe, atau pemegang…"></label>
        <label class="filter"><span>Jenis kendaraan</span><EnumSelect v-model="filters.jenis_kendaraan" group="jenis_kendaraan" placeholder="Semua jenis" /></label>
        <label class="filter"><span>Kondisi</span><EnumSelect v-model="filters.kondisi" group="kondisi" placeholder="Semua kondisi" /></label>
        <label class="filter"><span>Perangkat daerah</span><select v-model="filters.perangkat_daerah_id"><option value="">Semua unit</option>
          <option v-for="u in units" :key="u.id" :value="String(u.id)">{{ u.singkatan || u.nama_dinas }}</option></select></label>
        <label class="filter"><span>Status data</span><select v-model="filters.is_aktif"><option value="">Aktif & nonaktif</option><option value="1">Aktif</option><option value="0">Nonaktif</option></select></label>
        <label class="check"><input type="checkbox" :checked="filters.tanpa_pemegang === '1'" @change="filters.tanpa_pemegang = $event.target.checked ? '1' : ''"> Belum ada pemegang</label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>No. Polisi</th><th>Merek / Tipe</th><th>Jenis</th><th>Unit</th><th>Kondisi</th><th>Pemegang</th></tr></thead>
        <tbody>
          <tr v-for="k in rows" :key="k.id" :class="{ inactive: !k.is_aktif }">
            <td data-label="No. Polisi"><a :href="'#/kdo/' + k.id"><b>{{ k.nomor_polisi }}</b></a><span class="sub">{{ k.tahun_produksi }}<template v-if="!k.is_aktif"> · nonaktif</template></span></td>
            <td data-label="Merek / Tipe">{{ kendaraan(k) }}<span class="sub">{{ k.warna }}</span></td>
            <td data-label="Jenis">{{ label('jenis_kendaraan', k.jenis_kendaraan) }}</td>
            <td data-label="Unit">{{ k.perangkat_daerah_singkatan || k.perangkat_daerah }}</td>
            <td data-label="Kondisi"><Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge></td>
            <td data-label="Pemegang"><template v-if="k.pemegang_nama">{{ k.pemegang_nama }}<span class="sub">{{ k.pemegang_jabatan }}</span></template>
              <Badge v-else tone="warn">Belum ada pemegang</Badge></td>
          </tr>
        </tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada kendaraan yang cocok' : 'Belum ada data kendaraan'"
        :hint="hasFilter() ? 'Coba kata kunci lain atau hapus filter.' : 'Mulai dengan menambahkan kendaraan dinas pertama.'">
        <a v-if="isAdmin && !hasFilter()" class="btn primary" href="#/kdo/baru">+ Tambah Kendaraan</a>
      </EmptyState>
      <Pager :meta="meta" @page="goTo" />
    </div>
  </div>`,
};

export const KdoDetail = {
  components: { Badge, PageHeader, ConfirmDialog, EmptyState, TautkanDialog, TutupPemakaianDialog, PerawatanDialog },
  setup() {
    const k = ref(null);
    const perawatan = ref({ rows: [], ringkasan: null });
    const error = ref('');
    const dialog = ref(null); // 'hapus' | 'tautkan' | 'tutup' | { perawatan } | { hapusPerawatan }

    async function load() {
      try {
        const id = route.params.id;
        const [detail, rawat] = await Promise.all([api.get(`/kdo/${id}`), api.get('/perawatan', { kdo_id: id, per_page: 1000 })]);
        k.value = detail.data;
        perawatan.value = { rows: rawat.data, ringkasan: rawat.meta.ringkasan };
      } catch (e) { error.value = e.message; }
    }
    onMounted(load);
    const done = () => { dialog.value = null; load(); };

    const jadwal = computed(() => {
      const j = k.value?.perawatan_ringkas?.jadwal_berikutnya;
      if (!j) return null;
      const days = Math.round((Date.parse(j) - Date.parse(today())) / 864e5);
      const batasHari = store.settings?.pengingat_servis_hari ?? 14;
      const status = days < 0 ? 'terlambat' : days <= batasHari ? 'segera' : 'terjadwal';
      return { date: j, status };
    });

    const removeKdo = () => api.del(`/kdo/${k.value.id}`);
    const removePerawatan = () => api.del(`/perawatan/${dialog.value.hapusPerawatan.id}`);
    return { k, perawatan, error, dialog, done, jadwal, removeKdo, removePerawatan, navigate, isAdmin,
      label, tone, tanggal, rupiah, angka, jatuhTempo, kendaraan, STATUS_JADWAL_LABEL };
  },
  template: `<div>
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!k && !error" />
    <template v-if="k">
      <PageHeader :title="k.nomor_polisi" :subtitle="kendaraan(k) + ' · ' + k.perangkat_daerah" back="#/kdo" back-label="Kendaraan Dinas">
        <template #badges> <Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge>
          <Badge v-if="!k.is_aktif" tone="muted">Nonaktif</Badge></template>
        <template v-if="isAdmin">
          <button class="danger" @click="dialog = 'hapus'">Hapus</button>
          <a class="btn primary" :href="'#/kdo/' + k.id + '/ubah'">Ubah Data</a>
        </template>
      </PageHeader>

      <div class="grid two">
        <div class="card"><h2>Identitas</h2><dl class="kv">
          <dt>Merek / Tipe</dt><dd>{{ kendaraan(k) }}</dd>
          <dt>Jenis</dt><dd>{{ label('jenis_kendaraan', k.jenis_kendaraan) }}</dd>
          <dt>Tahun produksi</dt><dd>{{ k.tahun_produksi }}</dd>
          <dt>Warna</dt><dd>{{ k.warna || '-' }}</dd>
          <dt>Isi silinder</dt><dd>{{ k.isi_silinder_cc ? angka(k.isi_silinder_cc) + ' cc' : '-' }}</dd>
          <dt>Bahan bakar</dt><dd>{{ label('bahan_bakar', k.bahan_bakar) }}</dd>
        </dl></div>
        <div class="card"><h2>Legalitas</h2><dl class="kv">
          <dt>No. rangka</dt><dd>{{ k.nomor_rangka }}</dd>
          <dt>No. mesin</dt><dd>{{ k.nomor_mesin }}</dd>
          <dt>No. BPKB</dt><dd>{{ k.nomor_bpkb || '-' }}</dd>
          <dt>Masa berlaku STNK</dt><dd><Badge :tone="jatuhTempo(k.masa_berlaku_stnk).tone">{{ jatuhTempo(k.masa_berlaku_stnk).text }}</Badge></dd>
          <dt>Jatuh tempo pajak</dt><dd><Badge :tone="jatuhTempo(k.tanggal_pajak).tone">{{ jatuhTempo(k.tanggal_pajak).text }}</Badge></dd>
        </dl></div>
        <div class="card"><h2>Nilai & Aset</h2><dl class="kv">
          <dt>Kode barang aset</dt><dd>{{ k.kode_barang_aset || '-' }}</dd>
          <dt>Tanggal perolehan</dt><dd>{{ tanggal(k.tanggal_perolehan) }}</dd>
          <dt>Nilai perolehan</dt><dd>{{ rupiah(k.nilai_perolehan) }}</dd>
          <dt>Keterangan</dt><dd>{{ k.keterangan || '-' }}</dd>
        </dl></div>
        <div class="card"><h2>Penempatan & Pemegang</h2><dl class="kv">
          <dt>Perangkat daerah</dt><dd><a :href="'#/perangkat-daerah/' + k.perangkat_daerah_id">{{ k.perangkat_daerah }}</a></dd>
          <dt>Pemegang</dt><dd>
            <template v-if="k.pemegang_pns_id"><a :href="'#/pns/' + k.pemegang_pns_id">{{ k.pemegang_nama }}</a><span class="sub">{{ k.pemegang_nip }} · {{ k.pemegang_jabatan }}</span></template>
            <Badge v-else tone="warn">Belum ada pemegang</Badge></dd>
          <template v-if="k.pemakaian_aktif"><dt>Dipakai sejak</dt><dd>{{ tanggal(k.pemakaian_aktif.tanggal_mulai) }}</dd></template>
        </dl>
          <div v-if="isAdmin && k.is_aktif" class="actions" style="margin-top:14px">
            <button v-if="k.pemakaian_aktif" class="small" @click="dialog = 'tutup'">Tutup Pemakaian</button>
            <button v-else class="small primary" @click="dialog = 'tautkan'">Tautkan Pemakai</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-head"><h2>Riwayat Perawatan</h2>
          <button v-if="isAdmin" class="small primary" @click="dialog = { perawatan: {} }">+ Catat Perawatan</button></div>
        <div class="grid stats compact">
          <div class="stat"><div class="label">Total biaya perawatan</div><div class="value">{{ rupiah(perawatan.ringkasan?.total_biaya ?? 0) }}</div></div>
          <div class="stat"><div class="label">Jumlah servis</div><div class="value">{{ perawatan.ringkasan?.jumlah ?? 0 }}</div></div>
          <div class="stat"><div class="label">Jadwal servis berikutnya</div>
            <div class="value small">{{ jadwal ? tanggal(jadwal.date) : '-' }}</div>
            <Badge v-if="jadwal" :tone="tone('status_jadwal', jadwal.status)">{{ STATUS_JADWAL_LABEL[jadwal.status] }}</Badge></div>
        </div>
        <div class="table-wrap"><table class="stack">
          <thead><tr><th>Tanggal</th><th>Jenis</th><th>Bengkel</th><th class="num">Biaya</th><th>Kondisi setelah</th><th>Jadwal berikutnya</th><th v-if="isAdmin"></th></tr></thead>
          <tbody><tr v-for="r in perawatan.rows" :key="r.id">
            <td data-label="Tanggal">{{ tanggal(r.tanggal_servis) }}</td>
            <td data-label="Jenis">{{ label('jenis_perawatan', r.jenis_perawatan) }}<span class="sub">{{ r.deskripsi }}</span></td>
            <td data-label="Bengkel">{{ r.bengkel || '-' }}</td><td data-label="Biaya" class="num">{{ rupiah(r.biaya) }}</td>
            <td data-label="Kondisi setelah"><Badge :tone="tone('kondisi', r.kondisi_setelah)">{{ label('kondisi', r.kondisi_setelah) }}</Badge></td>
            <td data-label="Jadwal berikutnya">{{ tanggal(r.jadwal_berikutnya) }}</td>
            <td data-label="" v-if="isAdmin" class="row-actions"><button class="small" @click="dialog = { perawatan: r }">Ubah</button>
              <button class="small danger" @click="dialog = { hapusPerawatan: r }">Hapus</button></td>
          </tr></tbody>
        </table></div>
        <EmptyState v-if="!perawatan.rows.length" title="Belum ada catatan perawatan" />
      </div>

      <div class="card"><h2>Riwayat Pemakaian</h2>
        <div class="table-wrap"><table class="stack">
          <thead><tr><th>Pegawai</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Keterangan</th></tr></thead>
          <tbody><tr v-for="r in k.riwayat_pemakaian" :key="r.id">
            <td data-label="Pegawai"><a v-if="r.pns_id" :href="'#/pns/' + r.pns_id">{{ r.pns_nama }}</a><template v-else>{{ r.pns_nama }}</template><span class="sub">{{ r.pns_nip }}</span></td>
            <td data-label="Mulai">{{ tanggal(r.tanggal_mulai) }}</td><td data-label="Selesai">{{ r.tanggal_selesai ? tanggal(r.tanggal_selesai) : 'Masih berjalan' }}</td>
            <td data-label="Status"><Badge :tone="tone('status_pemakaian', r.status)">{{ label('status_pemakaian', r.status) }}</Badge></td>
            <td data-label="Keterangan">{{ r.keterangan || '-' }}</td></tr></tbody>
        </table></div>
        <EmptyState v-if="!k.riwayat_pemakaian.length" title="Belum ada riwayat pemakaian" />
      </div>

      <ConfirmDialog v-if="dialog === 'hapus'" title="Hapus Kendaraan" :action="removeKdo" @close="dialog = null" @done="navigate('/kdo')">
        Hapus kendaraan <b>{{ k.nomor_polisi }}</b> ({{ kendaraan(k) }})?
        <p class="hint">{{ k.riwayat_pemakaian.length }} riwayat pemakaian dan {{ perawatan.rows.length }} catatan perawatan ikut terhapus.
          Bila kendaraan hanya tidak lagi dipakai, pertimbangkan menonaktifkannya saja.</p>
      </ConfirmDialog>
      <ConfirmDialog v-if="dialog?.hapusPerawatan" title="Hapus Catatan Perawatan" :action="removePerawatan" @close="dialog = null" @done="done">
        Hapus catatan {{ label('jenis_perawatan', dialog.hapusPerawatan.jenis_perawatan) }} tanggal <b>{{ tanggal(dialog.hapusPerawatan.tanggal_servis) }}</b>
        sebesar {{ rupiah(dialog.hapusPerawatan.biaya) }}?
      </ConfirmDialog>
      <TautkanDialog v-if="dialog === 'tautkan'" :kdo="k" @close="dialog = null" @saved="done" />
      <TutupPemakaianDialog v-if="dialog === 'tutup'" :pemakaian="{ ...k.pemakaian_aktif, nomor_polisi: k.nomor_polisi }" @close="dialog = null" @saved="done" />
      <PerawatanDialog v-if="dialog?.perawatan" :kdo="k" :record="dialog.perawatan" @close="dialog = null" @saved="done" />
    </template>
  </div>`,
};

export const KdoForm = {
  components: { PageHeader, Field, EnumSelect },
  setup() {
    const id = route.params.id;
    const units = ref([]);
    const pegawai = ref([]);
    const original = ref(null);
    const form = useForm(schemas.kdo, {
      nomor_polisi: '', merek: '', tipe: '', tahun_produksi: new Date().getFullYear(), warna: '', kondisi: 'baik',
      jenis_kendaraan: 'roda_4', nomor_rangka: '', nomor_mesin: '', isi_silinder_cc: null, bahan_bakar: null, nomor_bpkb: '',
      masa_berlaku_stnk: null, tanggal_pajak: null, tanggal_perolehan: null, nilai_perolehan: null, kode_barang_aset: '',
      perangkat_daerah_id: route.query.perangkat_daerah_id ? Number(route.query.perangkat_daerah_id) : null,
      pemegang_pns_id: null, keterangan: '', is_aktif: 1,
    });
    const loaded = ref(!id);
    onMounted(async () => {
      try {
        [units.value, pegawai.value] = await Promise.all([fetchOptions('/perangkat-daerah'), fetchOptions('/pns', { status_kepegawaian: 'aktif' })]);
        if (id) {
          original.value = (await api.get(`/kdo/${id}`)).data;
          Object.assign(form.values, original.value);
          loaded.value = true;
        }
      } catch (e) { form.state.message = e.message; }
    });
    // Pemegang yang sedang memakai tidak diganti dari form ini. Gunakan Tutup/Tautkan pemakaian agar riwayat terbentuk.
    const pemegangLocked = computed(() => !!original.value?.pemakaian_aktif);
    async function save() {
      const res = await form.submit((v) => (id ? api.put(`/kdo/${id}`, v) : api.post('/kdo', v)),
        { success: id ? 'Data kendaraan diperbarui' : 'Kendaraan ditambahkan' });
      if (res) navigate(`/kdo/${res.data.id}`);
    }
    return { id, units, pegawai, original, pemegangLocked, loaded, ...form, save, today };
  },
  template: `<div v-if="!loaded"><div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div><LoadingState v-else /></div>
  <form v-else @submit.prevent="save" novalidate>
    <PageHeader :title="id ? 'Ubah Kendaraan Dinas' : 'Tambah Kendaraan Dinas'" :subtitle="original ? original.nomor_polisi : ''" :back="id ? '#/kdo/' + id : '#/kdo'" />
    <div v-if="state.message" class="alert error" role="alert">{{ state.message }}</div>

    <div class="card"><h2>Identitas</h2><div class="form">
      <Field label="Nomor polisi" name="nomor_polisi" :error="errors.nomor_polisi" required hint="Contoh: B 1234 ABC"><input id="nomor_polisi" v-model="values.nomor_polisi" maxlength="15" autocomplete="off"></Field>
      <Field label="Merek" name="merek" :error="errors.merek" required><input id="merek" v-model="values.merek" maxlength="50"></Field>
      <Field label="Tipe / model" name="tipe" :error="errors.tipe"><input id="tipe" v-model="values.tipe" maxlength="80"></Field>
      <Field label="Jenis kendaraan" name="jenis_kendaraan" :error="errors.jenis_kendaraan" required><EnumSelect id="jenis_kendaraan" v-model="values.jenis_kendaraan" group="jenis_kendaraan" /></Field>
      <Field label="Tahun produksi" name="tahun_produksi" :error="errors.tahun_produksi" required hint="1980–2100"><input id="tahun_produksi" type="number" min="1980" max="2100" v-model="values.tahun_produksi"></Field>
      <Field label="Warna" name="warna" :error="errors.warna"><input id="warna" v-model="values.warna" maxlength="30"></Field>
      <Field label="Isi silinder (cc)" name="isi_silinder_cc" :error="errors.isi_silinder_cc"><input id="isi_silinder_cc" type="number" min="0" v-model="values.isi_silinder_cc"></Field>
      <Field label="Bahan bakar" name="bahan_bakar" :error="errors.bahan_bakar"><EnumSelect id="bahan_bakar" v-model="values.bahan_bakar" group="bahan_bakar" /></Field>
      <Field label="Kondisi" name="kondisi" :error="errors.kondisi" required :hint="id ? 'Juga diperbarui otomatis oleh catatan perawatan terbaru' : ''"><EnumSelect id="kondisi" v-model="values.kondisi" group="kondisi" /></Field>
    </div></div>

    <div class="card"><h2>Legalitas</h2><div class="form">
      <Field label="Nomor rangka" name="nomor_rangka" :error="errors.nomor_rangka" required><input id="nomor_rangka" v-model="values.nomor_rangka" maxlength="30"></Field>
      <Field label="Nomor mesin" name="nomor_mesin" :error="errors.nomor_mesin" required><input id="nomor_mesin" v-model="values.nomor_mesin" maxlength="30"></Field>
      <Field label="Nomor BPKB" name="nomor_bpkb" :error="errors.nomor_bpkb"><input id="nomor_bpkb" v-model="values.nomor_bpkb" maxlength="30"></Field>
      <Field label="Masa berlaku STNK" name="masa_berlaku_stnk" :error="errors.masa_berlaku_stnk"><input id="masa_berlaku_stnk" type="date" v-model="values.masa_berlaku_stnk"></Field>
      <Field label="Jatuh tempo pajak" name="tanggal_pajak" :error="errors.tanggal_pajak"><input id="tanggal_pajak" type="date" v-model="values.tanggal_pajak"></Field>
    </div></div>

    <div class="card"><h2>Nilai & Aset</h2><div class="form">
      <Field label="Kode barang aset" name="kode_barang_aset" :error="errors.kode_barang_aset" hint="Kode register BMD"><input id="kode_barang_aset" v-model="values.kode_barang_aset" maxlength="30"></Field>
      <Field label="Tanggal perolehan" name="tanggal_perolehan" :error="errors.tanggal_perolehan"><input id="tanggal_perolehan" type="date" v-model="values.tanggal_perolehan" :max="today()"></Field>
      <Field label="Nilai perolehan (Rp)" name="nilai_perolehan" :error="errors.nilai_perolehan"><input id="nilai_perolehan" type="number" min="0" step="0.01" v-model="values.nilai_perolehan"></Field>
    </div></div>

    <div class="card"><h2>Penempatan</h2><div class="form">
      <Field label="Perangkat daerah" name="perangkat_daerah_id" :error="errors.perangkat_daerah_id" required>
        <select id="perangkat_daerah_id" v-model.number="values.perangkat_daerah_id"><option :value="null">Pilih perangkat daerah</option>
          <option v-for="u in units" :key="u.id" :value="u.id" :disabled="!u.is_aktif && u.id !== values.perangkat_daerah_id">{{ u.nama_dinas }}{{ u.is_aktif ? '' : ' (nonaktif)' }}</option></select></Field>
      <Field label="Pemegang" name="pemegang_pns_id" :error="errors.pemegang_pns_id"
        :hint="pemegangLocked ? 'Sedang dipakai. Ganti pemegang lewat Tutup/Tautkan pemakaian di halaman detail' : 'Opsional. Hanya PNS aktif; akan tercatat sebagai pemakaian mulai hari ini'">
        <select id="pemegang_pns_id" v-model.number="values.pemegang_pns_id" :disabled="pemegangLocked"><option :value="null">Tanpa pemegang</option>
          <option v-if="original?.pemegang_pns_id && !pegawai.some(p => p.id === original.pemegang_pns_id)" :value="original.pemegang_pns_id">{{ original.pemegang_nama }}</option>
          <option v-for="p in pegawai" :key="p.id" :value="p.id">{{ p.nama_pegawai }} · {{ p.perangkat_daerah_singkatan || p.perangkat_daerah }}</option></select></Field>
      <Field label="Status data" name="is_aktif"><label class="check"><input id="is_aktif" type="checkbox" :checked="!!values.is_aktif" @change="values.is_aktif = $event.target.checked ? 1 : 0"> Aktif</label></Field>
      <Field label="Keterangan" name="keterangan" :error="errors.keterangan" full><textarea id="keterangan" v-model="values.keterangan" rows="2"></textarea></Field>
    </div></div>

    <div class="actions"><button class="primary" :disabled="state.busy">{{ state.busy ? 'Menyimpan…' : 'Simpan' }}</button>
      <a class="btn" :href="id ? '#/kdo/' + id : '#/kdo'">Batal</a></div>
  </form>`,
};
