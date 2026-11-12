// Fitur 03 (Pemakai Kendaraan): pemakaian aktif & riwayat, tautkan pemakai, tutup pemakaian.
import { ref } from '../../vendor/vue.js';
import { isAdmin } from '../store.js';
import { label, tone, tanggal, kendaraan } from '../format.js';
import { useList } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, EnumSelect } from '../components/ui.js';
import { TautkanDialog, TutupPemakaianDialog } from '../components/dialogs.js';

export const PemakaianPage = {
  components: { Badge, EmptyState, PageHeader, Pager, EnumSelect, TautkanDialog, TutupPemakaianDialog },
  setup() {
    const list = useList('/pemakaian', { q: '', status: '' });
    const dialog = ref(null);
    const done = () => { dialog.value = null; list.load(); };
    return { ...list, dialog, done, isAdmin, label, tone, tanggal, kendaraan };
  },
  template: `<div>
    <PageHeader title="Pemakai Kendaraan" subtitle="Siapa memakai kendaraan apa, dan dalam periode kapan">
      <a class="btn" href="#/pns">Daftar Pegawai</a>
      <button v-if="isAdmin" class="primary" @click="dialog = 'tautkan'">+ Tautkan Pemakai</button>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor polisi, nama, atau NIP pegawai…"></label>
        <label class="filter"><span>Status pemakaian</span><EnumSelect v-model="filters.status" group="status_pemakaian" placeholder="Aktif & selesai" /></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Kendaraan</th><th>Pegawai</th><th>Unit</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Keperluan</th><th v-if="isAdmin"></th></tr></thead>
        <tbody><tr v-for="r in rows" :key="r.id">
          <td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a><span class="sub">{{ kendaraan(r) }}</span></td>
          <td data-label="Pegawai"><a v-if="r.pns_id" :href="'#/pns/' + r.pns_id">{{ r.pns_nama }}</a><template v-else>{{ r.pns_nama }}</template><span class="sub code">{{ r.pns_nip }}</span></td>
          <td data-label="Unit">{{ r.perangkat_daerah }}</td>
          <td data-label="Mulai">{{ tanggal(r.tanggal_mulai) }}</td><td data-label="Selesai">{{ r.tanggal_selesai ? tanggal(r.tanggal_selesai) : 'Masih berjalan' }}</td>
          <td data-label="Status"><Badge :tone="tone('status_pemakaian', r.status)">{{ label('status_pemakaian', r.status) }}</Badge></td>
          <td data-label="Keperluan">{{ r.keterangan || '-' }}</td>
          <td data-label="" v-if="isAdmin"><button v-if="r.status === 'aktif'" class="small" @click="dialog = r">Tutup</button></td>
        </tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada pemakaian yang cocok' : 'Belum ada pemakaian kendaraan'"
        hint="Tautkan pegawai ke kendaraan untuk mulai mencatat pemakaian." />
      <Pager :meta="meta" @page="goTo" />
    </div>
    <TautkanDialog v-if="dialog === 'tautkan'" @close="dialog = null" @saved="done" />
    <TutupPemakaianDialog v-else-if="dialog" :pemakaian="dialog" @close="dialog = null" @saved="done" />
  </div>`,
};
