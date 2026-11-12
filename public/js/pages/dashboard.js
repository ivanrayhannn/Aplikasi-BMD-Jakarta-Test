// Fitur 01 (Dashboard Kendaraan) + pengingat fitur 07.
// Disusun di sekitar satu keputusan: kendaraan mana yang perlu perhatian sekarang.
import { ref, computed, onMounted } from '../../vendor/vue.js';
import { api } from '../api.js';
import { label, tone, tanggal, waktu, angka, kendaraan, jatuhTempo, STATUS_JADWAL_LABEL } from '../format.js';
import { Badge, EmptyState, PageHeader } from '../components/ui.js';

/** Rp11,2 miliar: nilai besar dibaca lebih cepat dalam satuan juta/miliar. */
function ringkasRupiah(n) {
  if (n >= 1e12) return `Rp${(n / 1e12).toLocaleString('id-ID', { maximumFractionDigits: 1 })} triliun`;
  if (n >= 1e9) return `Rp${(n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 })} miliar`;
  if (n >= 1e6) return `Rp${(n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 })} juta`;
  return `Rp${Math.round(n).toLocaleString('id-ID')}`;
}

export const Dashboard = {
  components: { Badge, EmptyState, PageHeader },
  setup() {
    const d = ref(null);
    const meta = ref(null);
    const error = ref('');
    onMounted(async () => {
      try { ({ data: d.value, meta: meta.value } = await api.get('/dashboard')); } catch (e) { error.value = e.message; }
    });
    const kondisi = computed(() => (d.value ? [
      { key: 'baik', text: 'Baik', n: d.value.kondisi.baik },
      { key: 'rusak_ringan', text: 'Perlu servis / rusak ringan', n: d.value.kondisi.rusak_ringan },
      { key: 'rusak_berat', text: 'Rusak berat', n: d.value.kondisi.rusak_berat },
    ] : []));
    const perhatian = computed(() => (d.value
      ? d.value.pengingat.servis.length + d.value.pengingat.dokumen.length + d.value.pengingat.pembaruan_data.length : 0));
    return { d, meta, error, kondisi, perhatian, ringkasRupiah, label, tone, tanggal, waktu, angka, kendaraan, jatuhTempo, STATUS_JADWAL_LABEL };
  },
  template: `<div>
    <PageHeader title="Dashboard Kendaraan" subtitle="Kondisi dan pemakaian kendaraan dinas operasional" />
    <div v-if="error" class="alert error">{{ error }}</div>
    <LoadingState v-if="!d && !error" />
    <template v-if="d">
      <section class="fleet card" aria-label="Ringkasan armada">
        <a class="fleet-total" href="#/kdo">
          <span class="fleet-number">{{ angka(d.total_aset) }}</span>
          <span class="fleet-caption">Total Kendaraan Dinas<span class="sub">nilai perolehan {{ ringkasRupiah(d.nilai_perolehan_total) }}<template v-if="d.total_nonaktif">, {{ d.total_nonaktif }} nonaktif tidak dihitung</template></span></span>
        </a>
        <div class="fleet-condition">
          <div class="bar" role="img" :aria-label="kondisi.map(k => k.text + ' ' + k.n).join(', ')">
            <span v-for="k in kondisi" :key="k.key" :class="tone('kondisi', k.key)" :style="{ flexGrow: k.n }"></span>
          </div>
          <div class="condition-links">
            <a v-for="k in kondisi" :key="k.key" :href="'#/kdo?kondisi=' + k.key" :class="'cond ' + tone('kondisi', k.key)">
              <b>{{ k.n }}</b><span>{{ k.text }}</span></a>
            <a class="cond" href="#/pemakaian?status=aktif"><b>{{ d.sedang_dipakai.length }}</b><span>Sedang dipakai</span></a>
          </div>
        </div>
      </section>

      <div class="dash-grid">
        <section class="card attention" aria-labelledby="perhatian-judul">
          <div class="card-head"><h2 id="perhatian-judul">Perlu perhatian</h2><span class="sub">{{ perhatian }} butir</span></div>
          <EmptyState v-if="!perhatian" title="Tidak ada yang perlu ditindaklanjuti" hint="Servis, STNK, pajak, dan pembaruan data kendaraan masih dalam batas." />
          <template v-if="d.pengingat.servis.length">
            <h3>Jadwal servis <span class="sub-inline">terlewat atau dalam {{ meta.pengingat_servis_hari }} hari</span></h3>
            <ul class="reminders"><li v-for="s in d.pengingat.servis" :key="'s' + s.kdo_id">
              <a :href="'#/kdo/' + s.kdo_id"><Plate :nopol="s.nomor_polisi" /></a>
              <span>{{ kendaraan(s) }}</span>
              <Badge :tone="tone('status_jadwal', s.status_jadwal)">{{ STATUS_JADWAL_LABEL[s.status_jadwal] }}, {{ tanggal(s.jadwal_berikutnya) }}</Badge></li></ul>
          </template>
          <template v-if="d.pengingat.dokumen.length">
            <h3>STNK dan pajak <span class="sub-inline">habis atau dalam 30 hari</span></h3>
            <ul class="reminders"><li v-for="k in d.pengingat.dokumen" :key="'d' + k.id">
              <a :href="'#/kdo/' + k.id"><Plate :nopol="k.nomor_polisi" /></a>
              <span>STNK <Badge :tone="jatuhTempo(k.masa_berlaku_stnk).tone">{{ jatuhTempo(k.masa_berlaku_stnk).text }}</Badge></span>
              <span>Pajak <Badge :tone="jatuhTempo(k.tanggal_pajak).tone">{{ jatuhTempo(k.tanggal_pajak).text }}</Badge></span></li></ul>
          </template>
          <template v-if="d.pengingat.pembaruan_data.length">
            <h3>Data lama <span class="sub-inline">tidak diperbarui lebih dari {{ meta.pengingat_pembaruan_hari }} hari</span></h3>
            <ul class="reminders"><li v-for="k in d.pengingat.pembaruan_data" :key="'p' + k.id">
              <a :href="'#/kdo/' + k.id"><Plate :nopol="k.nomor_polisi" /></a><span>terakhir {{ waktu(k.updated_at) }}</span></li></ul>
          </template>
        </section>

        <section class="card" aria-labelledby="dipakai-judul">
          <div class="card-head"><h2 id="dipakai-judul">Sedang dipakai</h2><a href="#/pemakaian?status=aktif">Semua pemakaian</a></div>
          <ul class="vehicle-list"><li v-for="r in d.sedang_dipakai.slice(0, 8)" :key="r.pemakaian_id">
            <a :href="'#/kdo/' + r.kdo_id"><Plate :nopol="r.nomor_polisi" /></a>
            <span><b>{{ r.pns_nama }}</b><span class="sub">{{ kendaraan(r) }}, {{ r.perangkat_daerah_singkatan }}</span></span>
          </li></ul>
          <p v-if="d.sedang_dipakai.length > 8" class="hint">dan {{ d.sedang_dipakai.length - 8 }} kendaraan lain</p>
          <EmptyState v-if="!d.sedang_dipakai.length" title="Tidak ada kendaraan sedang dipakai" hint="Tautkan pemakai di menu Pemakai Kendaraan." />
        </section>

        <section class="card" aria-labelledby="terbaru-judul">
          <div class="card-head"><h2 id="terbaru-judul">Aset terbaru</h2><a href="#/kdo">Semua kendaraan</a></div>
          <ul class="vehicle-list"><li v-for="k in d.aset_terbaru" :key="k.id">
            <a :href="'#/kdo/' + k.id"><Plate :nopol="k.nomor_polisi" /></a>
            <span>{{ kendaraan(k) }}<span class="sub">{{ k.perangkat_daerah_singkatan }}, ditambahkan {{ waktu(k.created_at) }}</span></span>
            <Badge :tone="tone('kondisi', k.kondisi)">{{ label('kondisi', k.kondisi) }}</Badge>
          </li></ul>
          <EmptyState v-if="!d.aset_terbaru.length" title="Belum ada data kendaraan" hint="Tambahkan kendaraan pertama di menu Kendaraan Dinas." />
        </section>
      </div>
    </template>
  </div>`,
};
