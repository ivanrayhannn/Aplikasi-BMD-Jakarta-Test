// Fitur 03 (Penugasan & Pengembalian): penugasan aktif dan riwayatnya. Penugasan baru lewat pengajuan (perlu approval),
// pengakhiran lewat form Pengembalian Aset (pemeriksaan unit + berita acara).
import { ref } from '../../vendor/vue.js';
import { isAdmin, notify } from '../store.js';
import { navigate } from '../router.js';
import { label, tone, tanggal, kendaraan } from '../format.js';
import { useList } from '../components/list.js';
import { Badge, EmptyState, PageHeader, Pager, EnumSelect } from '../components/ui.js';
import { AjukanDialog, PengembalianDialog } from '../components/siklus-dialogs.js';

export const PemakaianPage = {
  components: { Badge, EmptyState, PageHeader, Pager, EnumSelect, AjukanDialog, PengembalianDialog },
  setup() {
    const list = useList('/pemakaian', { q: '', status: '' });
    const dialog = ref(null);
    function afterAjukan(pg) { dialog.value = null; notify(`Pengajuan ${pg.nomor} terkirim, menunggu persetujuan`); navigate(`/pengajuan/${pg.id}`); }
    function afterKembali(r) { dialog.value = null; notify(`Pengembalian tercatat, ${r.berita_acara_nomor}`); list.load(); }
    const kdoDari = (r) => ({ id: r.kdo_id, nomor_polisi: r.nomor_polisi, merek: r.merek, tipe: r.tipe, pemegang_nama: r.pns_nama, kondisi: 'baik' });
    return { ...list, dialog, afterAjukan, afterKembali, kdoDari, isAdmin, label, tone, tanggal, kendaraan };
  },
  template: `<div>
    <PageHeader title="Penugasan & Pengembalian" subtitle="Pegawai penanggung jawab setiap kendaraan: yang aktif dan riwayatnya">
      <a class="btn" href="#/pengajuan?jenis=penugasan">Pengajuan penugasan</a>
      <button v-if="isAdmin" class="primary" @click="dialog = 'ajukan'">+ Ajukan Penugasan</button>
    </PageHeader>
    <div v-if="error" class="alert error">{{ error }}</div>
    <div class="card">
      <div class="filters">
        <label class="filter grow"><span>Cari</span><input v-model="filters.q" type="search" placeholder="Nomor polisi, nama, atau NIP pegawai…"></label>
        <label class="filter"><span>Status penugasan</span><EnumSelect v-model="filters.status" group="status_pemakaian" placeholder="Aktif & selesai" /></label>
        <button v-if="hasFilter()" class="link" @click="reset">Hapus filter</button>
      </div>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Kendaraan</th><th>Pegawai</th><th>Unit</th><th>Mulai</th><th>Selesai</th><th>Status</th><th>Keterangan</th><th v-if="isAdmin"></th></tr></thead>
        <tbody><tr v-for="r in rows" :key="r.id">
          <td data-label="Kendaraan"><a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a><span class="sub">{{ kendaraan(r) }}</span></td>
          <td data-label="Pegawai"><a v-if="r.pns_id" :href="'#/pns/' + r.pns_id">{{ r.pns_nama }}</a><template v-else>{{ r.pns_nama }}</template><span class="sub code">{{ r.pns_nip }}</span></td>
          <td data-label="Unit">{{ r.perangkat_daerah }}</td>
          <td data-label="Mulai">{{ tanggal(r.tanggal_mulai) }}</td><td data-label="Selesai">{{ r.tanggal_selesai ? tanggal(r.tanggal_selesai) : 'Masih berjalan' }}</td>
          <td data-label="Status"><Badge :tone="tone('status_pemakaian', r.status)">{{ label('status_pemakaian', r.status) }}</Badge></td>
          <td data-label="Keterangan">{{ r.keterangan || '-' }}</td>
          <td data-label="" v-if="isAdmin"><button v-if="r.status === 'aktif'" class="small" @click="dialog = r">Pengembalian</button></td>
        </tr></tbody>
      </table></div>
      <LoadingState v-if="loading && !rows.length" />
      <EmptyState v-if="!rows.length && !loading" :title="hasFilter() ? 'Tidak ada penugasan yang cocok' : 'Belum ada penugasan kendaraan'"
        hint="Penugasan terbentuk setelah pengajuan disetujui dan diserahterimakan." />
      <Pager :meta="meta" @page="goTo" />
    </div>
    <AjukanDialog v-if="dialog === 'ajukan'" jenis="penugasan" @close="dialog = null" @saved="afterAjukan" />
    <PengembalianDialog v-else-if="dialog" :kdo="kdoDari(dialog)" @close="dialog = null" @saved="afterKembali" />
  </div>`,
};
