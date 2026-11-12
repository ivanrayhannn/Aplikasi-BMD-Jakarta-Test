// Menu Dokumen: tautan ke seluruh isi folder docs di GitHub. Berkas Excel memakai /raw/ agar langsung terunduh.
import { PageHeader } from '../components/ui.js';

const BASE = 'https://github.com/ivanrayhannn/Aplikasi-BMD-Jakarta-Test/blob/claude/dreamy-pascal-qxpvy1/';
const DOCS = [
  ['docs/PRD.md', 'PRD terdokumentasi', 'Kebutuhan, kriteria penerimaan, aturan bisnis, keputusan, keterlacakan'],
  ['docs/API.md', 'Referensi REST API', 'Endpoint, parameter, kode error'],
  ['docs/SETUP.md', 'Manual setup', 'Instalasi, menjalankan, verifikasi, pemecahan masalah'],
  ['docs/postman/KDO.postman_collection.json', 'Koleksi Postman', 'Uji seluruh endpoint secara berurutan'],
  ['docs/postman/KDO-local.postman_environment.json', 'Environment Postman', 'Variabel baseUrl lokal'],
  ['docs/screenshots/KDO-Screenshots.xlsx', 'Workbook screenshot', 'Bukti UI per alur'],
  ['docs/data/data_aset_kendaraan_dki.md', 'Data uji DKI', 'Sumber data SKPD, pegawai, kendaraan'],
  ['docs/prd/sumber/PRD.md', 'PRD sumber', 'PRD asli dari pemilik produk'],
  ['docs/prd/sumber/features', 'Spesifikasi fitur sumber', '8 berkas fitur asli'],
  ['db/mysql/kdo_master_tables.sql', 'DDL MySQL 8.4', 'Rancangan database'],
];

export const DokumenPage = {
  components: { PageHeader },
  setup: () => ({ docs: DOCS.map(([path, title, desc]) => ({ href: BASE.replace('/blob/', path.endsWith('features') ? '/tree/' : path.endsWith('.xlsx') ? '/raw/' : '/blob/') + path, title, desc, path })) }),
  template: `<div>
    <PageHeader title="Dokumen" subtitle="Dokumentasi proyek di repositori GitHub" />
    <div class="card"><ul class="vehicle-list doc-list"><li v-for="d in docs" :key="d.path">
      <a :href="d.href" target="_blank" rel="noopener">{{ d.title }}</a>
      <span>{{ d.desc }}<span class="sub code">{{ d.path }}</span></span>
    </li></ul></div>
  </div>`,
};
