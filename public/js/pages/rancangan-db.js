// Menu "Rancangan Database": ERD dan kamus data untuk ditinjau pengguna.
// Semua isi dibangkitkan dari src/shared/db-design.js, yang diuji sama dengan skema aplikasi.
import { computed } from '../../vendor/vue.js';
import { TABLES, RELATIONS, CONSTRAINTS } from '../../lib/shared/db-design.js';
import { PageHeader } from '../components/ui.js';

const KIND = {
  master: { label: 'Master', fill: '#0b4f8a' },
  transaksi: { label: 'Transaksi', fill: '#17704a' },
  sistem: { label: 'Sistem', fill: '#5d6878' },
};

// Tata letak ERD (koordinat SVG). Hanya kolom kunci (PK, FK, UK) yang digambar; kolom lengkap ada di kamus data.
const BOX_W = 230, HEAD = 30, ROW = 20, MORE = 22, PAD = 8;
const POS = {
  perangkat_daerah: [405, 20], pns: [60, 200], kdo: [750, 200], kdo_pemakaian: [405, 410],
  kdo_perawatan: [750, 470], users: [60, 560], sessions: [60, 730], settings: [405, 600], log_aktivitas: [405, 720],
};

/** Jalur garis relasi (dari tabel anak ke tabel induk) dan posisi label ON DELETE, disusun manual agar tidak bersilangan. */
const EDGES = {
  'pns.perangkat_daerah_id': { d: 'M175 200 V80 H405', label: [182, 120] },
  'kdo.perangkat_daerah_id': { d: 'M865 200 V80 H635', label: [872, 120] },
  'kdo.pemegang_pns_id': { d: 'M750 290 H290', label: [520, 282] },
  'kdo_pemakaian.kdo_id': { d: 'M635 460 H700 V360 H750', label: [656, 450] },
  'kdo_pemakaian.pns_id': { d: 'M405 470 H250 V320', label: [258, 462] },
  'kdo_perawatan.kdo_id': { d: 'M865 470 V380', label: [872, 430] },
  'users.pns_id': { d: 'M175 560 V320', label: [100, 540] },
  'sessions.user_id': { d: 'M175 730 V680', label: [182, 710] },
};

function boxes() {
  return TABLES.map((t) => {
    const keys = t.columns.filter((c) => c.key);
    const others = t.columns.length - keys.length;
    const [x, y] = POS[t.name];
    const h = HEAD + keys.length * ROW + (others ? MORE : 0) + PAD;
    return { ...t, x, y, h, keys, others, fill: KIND[t.kind].fill };
  });
}

const ErdDiagram = {
  setup() {
    const edges = RELATIONS.map((r) => {
      const nullable = TABLES.find((t) => t.name === r.from).columns.find((c) => c.name === r.column).nullable;
      return { ...r, ...EDGES[`${r.from}.${r.column}`], optional: nullable };
    });
    const summary = RELATIONS.map((r) => `${r.from} ke ${r.to} (${r.onDelete})`).join('; ');
    return { boxes: boxes(), edges, summary, BOX_W, HEAD, ROW };
  },
  template: `<div class="erd-wrap">
    <svg class="erd" viewBox="0 0 1000 850" role="img" :aria-label="'Diagram relasi entitas: ' + summary">
      <defs>
        <marker id="many" viewBox="0 0 12 12" refX="1" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M12 6 L1 1 M12 6 L1 11 M12 6 L1 6" fill="none" stroke="#1c2430" stroke-width="1.4" /></marker>
        <marker id="one" viewBox="0 0 12 12" refX="11" refY="6" markerWidth="12" markerHeight="12" orient="auto">
          <path d="M8 1 V11 M5 1 V11" fill="none" stroke="#1c2430" stroke-width="1.4" /></marker>
      </defs>
      <g v-for="e in edges" :key="e.from + e.column">
        <path :d="e.d" fill="none" stroke="#1c2430" stroke-width="1.4" :stroke-dasharray="e.optional ? '5 4' : null" marker-start="url(#many)" marker-end="url(#one)" />
        <text :x="e.label[0]" :y="e.label[1]" class="erd-label">{{ e.onDelete }}</text>
      </g>
      <g v-for="b in boxes" :key="b.name" :transform="'translate(' + b.x + ' ' + b.y + ')'">
        <rect :width="BOX_W" :height="b.h" rx="6" fill="#fff" stroke="#8a94a3" />
        <path :d="'M0 6 a6 6 0 0 1 6 -6 h' + (BOX_W - 12) + ' a6 6 0 0 1 6 6 v' + (HEAD - 6) + ' h-' + BOX_W + ' z'" :fill="b.fill" />
        <text x="12" y="20" class="erd-title">{{ b.name }}</text>
        <g v-for="(c, i) in b.keys" :key="c.name">
          <text x="12" :y="HEAD + 15 + i * ROW" class="erd-key">{{ c.key }}</text>
          <text x="42" :y="HEAD + 15 + i * ROW" class="erd-col">{{ c.name }}</text>
        </g>
        <text v-if="b.others" x="12" :y="HEAD + 15 + b.keys.length * ROW + 2" class="erd-more">+ {{ b.others }} kolom lain</text>
      </g>
    </svg>
  </div>`,
};

export const RancanganDbPage = {
  components: { PageHeader, ErdDiagram },
  setup() {
    const count = (kind) => TABLES.filter((t) => t.kind === kind).length;
    const relationsOf = (name) => RELATIONS.filter((r) => r.from === name || r.to === name);
    const totals = computed(() => ({
      tables: TABLES.length, master: count('master'), transaksi: count('transaksi'), sistem: count('sistem'),
      relations: RELATIONS.length, columns: TABLES.reduce((n, t) => n + t.columns.length, 0),
    }));
    return { TABLES, RELATIONS, CONSTRAINTS, KIND, totals, relationsOf };
  },
  template: `<div>
    <PageHeader title="Rancangan Database" subtitle="Rancangan RDBMS dan ERD sistem SI-KDO">
      <a class="btn" href="db/kdo_master_tables.sql" download>Unduh DDL MySQL</a>
    </PageHeader>

    <div class="alert info" role="note">
      <b>Catatan:</b> halaman ini adalah <b>rancangan database untuk sistem SI-KDO</b>, disajikan untuk ditinjau dan dinilai.
      Isinya struktur tabel dan relasi, bukan data aset. Produksi direncanakan memakai MySQL 8.4 (database <code>kdo_db</code>,
      DDL dapat diunduh di atas); aplikasi saat ini menjalankan rancangan yang sama di SQLite.
    </div>

    <div class="grid stats">
      <div class="stat"><div class="label">Tabel</div><div class="value">{{ totals.tables }}</div>
        <div class="sub">{{ totals.master }} master, {{ totals.transaksi }} transaksi, {{ totals.sistem }} sistem</div></div>
      <div class="stat"><div class="label">Relasi (foreign key)</div><div class="value">{{ totals.relations }}</div></div>
      <div class="stat"><div class="label">Kolom</div><div class="value">{{ totals.columns }}</div></div>
    </div>

    <div class="card">
      <div class="card-head"><h2>Diagram relasi entitas (ERD)</h2></div>
      <div class="erd-legend">
        <span v-for="(k, key) in KIND" :key="key"><i :style="{ background: k.fill }"></i>{{ k.label }}</span>
        <span>Garis putus-putus: relasi opsional (FK boleh kosong)</span>
        <span>Ujung bercabang: sisi "banyak"; dua garis: sisi "satu"</span>
      </div>
      <ErdDiagram />
      <p class="hint">Diagram hanya memuat kolom kunci (PK, FK, UK). Kolom lengkap ada di kamus data di bawah.</p>
    </div>

    <div class="card">
      <h2>Relasi dan aturan hapus</h2>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Tabel anak (FK)</th><th>Tabel induk</th><th>Kardinalitas</th><th>ON DELETE</th><th>Arti</th></tr></thead>
        <tbody><tr v-for="r in RELATIONS" :key="r.from + r.column">
          <td data-label="Tabel anak (FK)"><code>{{ r.from }}.{{ r.column }}</code></td>
          <td data-label="Tabel induk"><code>{{ r.to }}.id</code></td>
          <td data-label="Kardinalitas">Banyak ke satu</td>
          <td data-label="ON DELETE"><span class="badge muted">{{ r.onDelete }}</span></td>
          <td data-label="Arti">{{ r.meaning }}</td>
        </tr></tbody>
      </table></div>
      <h3 style="margin-top:16px">Aturan integritas lain</h3>
      <ul class="rules"><li v-for="c in CONSTRAINTS" :key="c">{{ c }}</li></ul>
    </div>

    <h2 class="section-title">Kamus data</h2>
    <details v-for="t in TABLES" :key="t.name" class="card dict" :open="t.kind === 'master'">
      <summary><code>{{ t.name }}</code> <span class="badge muted">{{ KIND[t.kind].label }}</span>
        <span class="sub">{{ t.purpose }} {{ t.columns.length }} kolom.</span></summary>
      <div class="table-wrap"><table class="stack">
        <thead><tr><th>Kolom</th><th>Tipe (MySQL)</th><th>Kunci</th><th>Boleh kosong</th><th>Keterangan</th></tr></thead>
        <tbody><tr v-for="c in t.columns" :key="c.name">
          <td data-label="Kolom"><code>{{ c.name }}</code></td>
          <td data-label="Tipe (MySQL)"><code class="type">{{ c.mysql }}</code></td>
          <td data-label="Kunci">{{ c.key || '-' }}</td>
          <td data-label="Boleh kosong">{{ c.nullable ? 'Ya' : 'Tidak' }}</td>
          <td data-label="Keterangan">{{ c.note }}</td>
        </tr></tbody>
      </table></div>
      <p v-if="relationsOf(t.name).length" class="hint">Relasi: {{ relationsOf(t.name).map(r => r.from + '.' + r.column + ' ke ' + r.to + ' (' + r.onDelete + ')').join('; ') }}</p>
    </details>
  </div>`,
};
