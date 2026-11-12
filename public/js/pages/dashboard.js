// Fitur 01: Dashboard Kendaraan (+ pengingat dari fitur 07).
import { ref, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { label, tone, tanggal, waktu, angka, kendaraan, jatuhTempo, STATUS_JADWAL_LABEL } from '../format.js';
import { Badge, EmptyState, PageHeader } from '../components/ui.js';

export const Dashboard = {
  components: { Badge, EmptyState, PageHeader },
  setup() {
    const d = ref(null);
    const meta = ref(null);
    const error = ref('');
    onMounted(async () => {
      try { ({ data: d.value, meta: meta.value } = await api.get('/dashboard')); } catch (e) { error.value = e.message; }
    });
    const pct = (n) => (d.value?.total_aset ? (n / d.value.total_aset) * 100 : 0);
    return { d, meta, error, pct, label, tone, tanggal, waktu, angka, kendaraan, jatuhTempo, STATUS_JADWAL_LABEL };
  },
  template: `<div>
    <PageHeader title="Dashboard Kendaraan" subtitle="Ringkasan aset kendaraan dinas operasional" />
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!d && !error" />
    <template v-if="d">
      <div class="grid stats">
        <a class="stat hero" href="#/kdo"><div class="label">Total Kendaraan Dinas</div><div class="value">{{ angka(d.total_aset) }}</div>
          <div class="sub" v-if="d.total_nonaktif">+ {{ d.total_nonaktif }} nonaktif</div></a>
        <a class="stat" href="#/pemakaian?status=aktif"><div class="label">Sedang Dipakai</div><div class="value">{{ angka(d.sedang_dipakai.length) }}</div></a>
        <a class="stat ok" href="#/kdo?kondisi=baik"><div class="label">Kondisi Baik</div><div class="value">{{ angka(d.kondisi.baik) }}</div></a>
        <a class="stat warn" href="#/kdo?kondisi=rusak_ringan"><div class="label">Perlu Servis / Rusak Ringan</div><div class="value">{{ angka(d.kondisi.rusak_ringan) }}</div></a>
        <a class="stat bad" href="#/kdo?kondisi=rusak_berat"><div class="label">Rusak Berat</div><div class="value">{{ angka(d.kondisi.rusak_berat) }}</div></a>
      </div>
      <div class="card" v-if="d.total_aset">
        <div class="bar" role="img" :aria-label="'Baik ' + d.kondisi.baik + ', rusak ringan ' + d.kondisi.rusak_ringan + ', rusak berat ' + d.kondisi.rusak_berat">
          <span class="ok" :style="{ width: pct(d.kondisi.baik) + '%' }"></span>
          <span class="warn" :style="{ width: pct(d.kondisi.rusak_ringan) + '%' }"></span>
          <span class="bad" :style="{ width: pct(d.kondisi.rusak_berat) + '%' }"></span>
        </div>
        <div class="legend"><span class="ok">Baik {{ d.kondisi.baik }}</span><span class="warn">Rusak ringan {{ d.kondisi.rusak_ringan }}</span><span class="bad">Rusak berat {{ d.kondisi.rusak_berat }}</span></div>
      </div>

      <div class="grid two">
        <div class="card"><div class="card-head"><h2>Kendaraan Sedang Dipakai</h2><a href="#/pemakaian?status=aktif">Lihat semua</a></div>
          <div class="table-wrap"><table class="stack">
            <thead><tr><th>No. Polisi</th><th>Kendaraan</th><th>Pemakai</th><th>Sejak</th></tr></thead>
            <tbody><tr v-for="r in d.sedang_dipakai.slice(0, 8)" :key="r.pemakaian_id">
              <td data-label="No. Polisi"><a :href="'#/kdo/' + r.kdo_id"><b>{{ r.nomor_polisi }}</b></a></td><td data-label="Kendaraan">{{ kendaraan(r) }}<span class="sub">{{ r.perangkat_daerah_singkatan }}</span></td>
              <td data-label="Pemakai">{{ r.pns_nama }}</td><td data-label="Sejak">{{ tanggal(r.tanggal_mulai) }}</td></tr></tbody>
          </table></div>
          <EmptyState v-if="!d.sedang_dipakai.length" title="Tidak ada kendaraan sedang dipakai" />
        </div>
        <div class="card"><div class="card-head"><h2>Aset Terbaru</h2><a href="#/kdo">Lihat semua</a></div>
          <div class="table-wrap"><table class="stack">
            <thead><tr><th>No. Polisi</th><th>Kendaraan</th><th>Ditambahkan</th></tr></thead>
            <tbody><tr v-for="k in d.aset_terbaru" :key="k.id">
              <td data-label="No. Polisi"><a :href="'#/kdo/' + k.id"><b>{{ k.nomor_polisi }}</b></a></td><td data-label="Kendaraan">{{ kendaraan(k) }}<span class="sub">{{ k.perangkat_daerah_singkatan }}</span></td>
              <td data-label="Ditambahkan">{{ waktu(k.created_at) }}</td></tr></tbody>
          </table></div>
          <EmptyState v-if="!d.aset_terbaru.length" title="Belum ada data kendaraan" hint="Tambahkan kendaraan pertama di menu Kendaraan Dinas." />
        </div>
      </div>

      <h2 class="section-title">Pengingat</h2>
      <div class="grid three">
        <div class="card"><div class="card-head"><h2>Servis ({{ d.pengingat.servis.length }})</h2><a href="#/perawatan">Jadwal</a></div>
          <p class="hint">Jadwal terlewat atau ≤ {{ meta.pengingat_servis_hari }} hari lagi</p>
          <ul class="reminders"><li v-for="s in d.pengingat.servis" :key="s.kdo_id">
            <a :href="'#/kdo/' + s.kdo_id">{{ s.nomor_polisi }}</a> <Badge :tone="tone('status_jadwal', s.status_jadwal)">{{ STATUS_JADWAL_LABEL[s.status_jadwal] }}</Badge>
            <span class="sub">{{ tanggal(s.jadwal_berikutnya) }}</span></li></ul>
          <EmptyState v-if="!d.pengingat.servis.length" title="Tidak ada servis yang mendesak" />
        </div>
        <div class="card"><h2>STNK / Pajak ({{ d.pengingat.dokumen.length }})</h2>
          <p class="hint">Habis atau ≤ 30 hari lagi</p>
          <ul class="reminders"><li v-for="k in d.pengingat.dokumen" :key="k.id">
            <a :href="'#/kdo/' + k.id">{{ k.nomor_polisi }}</a>
            <span class="sub">STNK: <Badge :tone="jatuhTempo(k.masa_berlaku_stnk).tone">{{ jatuhTempo(k.masa_berlaku_stnk).text }}</Badge></span>
            <span class="sub">Pajak: <Badge :tone="jatuhTempo(k.tanggal_pajak).tone">{{ jatuhTempo(k.tanggal_pajak).text }}</Badge></span></li></ul>
          <EmptyState v-if="!d.pengingat.dokumen.length" title="Semua dokumen masih berlaku" />
        </div>
        <div class="card"><h2>Pembaruan Data ({{ d.pengingat.pembaruan_data.length }})</h2>
          <p class="hint">Tidak diperbarui &gt; {{ meta.pengingat_pembaruan_hari }} hari</p>
          <ul class="reminders"><li v-for="k in d.pengingat.pembaruan_data" :key="k.id">
            <a :href="'#/kdo/' + k.id">{{ k.nomor_polisi }}</a><span class="sub">terakhir {{ waktu(k.updated_at) }}</span></li></ul>
          <EmptyState v-if="!d.pengingat.pembaruan_data.length" title="Data kendaraan mutakhir" />
        </div>
      </div>
    </template>
  </div>`,
};
