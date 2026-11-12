// Uji click-through seluruh kontrol UI dengan Playwright (bukti R-35).
// Pakai: node test/e2e/click-through.cjs [baseUrl]   (default http://localhost:3000/, database berisi data contoh)
// Butuh paket `playwright` beserta Chromium yang sudah terpasang di mesin.
const { chromium, devices } = require('playwright');
const fs = require('node:fs');

const BASE = process.argv[2] || 'http://localhost:3000/';
const log = [];
const ok = (msg) => { log.push(`PASS ${msg}`); console.log(`PASS ${msg}`); };
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

async function login(page, email, password) {
  await page.goto(BASE);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('form button.primary');
}

/** Pilih opsi <select> yang teksnya memuat `text`. */
async function pick(page, selector, text) {
  const handle = await page.waitForFunction(([sel, t]) => {
    const el = document.querySelector(sel);
    return el && [...el.options].find((o) => o.text.includes(t))?.value;
  }, [selector, text], { timeout: 5000 });
  const value = await handle.jsonValue();
  await page.selectOption(selector, value);
}

const toast = (page, text) => page.waitForSelector(`.toast:has-text("${text}")`, { timeout: 5000 });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d)/.test(m.text()) && errors.push(m.text()));
  page.on('dialog', (d) => d.accept());

  // Masuk & hak akses
  await login(page, 'admin@kdo.test', 'salah123');
  await page.waitForSelector('.alert.error:has-text("Email atau kata sandi salah")');
  ok('Login salah -> pesan "Email atau kata sandi salah", tetap di halaman masuk');
  await page.fill('#email', '');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error:has-text("Email wajib diisi")');
  ok('Login kosong -> validasi per field');
  await login(page, 'admin@kdo.test', 'admin12345');
  await page.waitForSelector('h1:has-text("Dashboard Kendaraan")');
  ok('Login admin -> Dashboard, nama & peran tampil di sidebar');

  // Dashboard
  await page.click('a.stat.hero');
  await page.waitForSelector('h1:has-text("Kendaraan Dinas")');
  ok('Kartu Total Kendaraan -> daftar kendaraan');
  await page.goto(BASE + '#/dashboard');
  await page.click('a.stat.bad');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2 && document.querySelector('tbody').textContent.includes('B 3920 PQJ'));
  ok('Kartu Rusak Berat -> daftar tersaring kondisi rusak berat (2 kendaraan)');

  // Daftar kendaraan: cari, saring, hapus filter
  await page.goto(BASE + '#/kdo');
  await page.fill('input[type=search]', 'isuzu');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2);
  ok('Cari "isuzu" -> 2 kendaraan');
  await page.fill('input[type=search]', 'zzzz');
  await page.waitForSelector('.empty:has-text("Tidak ada kendaraan yang cocok")');
  ok('Pencarian tanpa hasil -> state kosong dengan arahan');
  await page.click('button.link:has-text("Hapus filter")');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 20);
  ok('Hapus filter -> 20 kendaraan kembali');
  await page.check('label.check:has-text("Belum ada pemegang") input');
  await page.waitForSelector('.empty:has-text("Tidak ada kendaraan yang cocok")');
  ok('Filter "Belum ada pemegang" -> semua kendaraan punya pemegang, state kosong tampil');

  // Tambah kendaraan: validasi klien, duplikat dari server, sukses
  await page.goto(BASE + '#/kdo/baru');
  await page.click('form button.primary');
  await page.waitForSelector('#nomor_polisi ~ .field-error, .field.invalid');
  ok('Simpan form kosong -> pesan per field, data tidak terkirim');
  await page.fill('#nomor_polisi', 'b 1426 pqa');
  await page.fill('#merek', 'Suzuki');
  await page.fill('#tipe', 'Ertiga');
  await page.fill('#nomor_rangka', 'UJI-RANGKA-01');
  await page.fill('#nomor_mesin', 'UJI-MESIN-01');
  await pick(page, '#perangkat_daerah_id', 'Dinas Kesehatan');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error:has-text("sudah terdaftar")');
  ok('Nomor polisi ganda -> 422 ditampilkan di field nomor polisi');
  await page.fill('#nomor_polisi', 'b 5555 uji');
  await pick(page, '#pemegang_pns_id', 'Putri Ayu Anggraini');
  await page.click('form button.primary');
  await page.waitForSelector('h1:has-text("B 5555 UJI")');
  await page.waitForSelector('dd:has-text("Putri Ayu Anggraini")');
  ok('Tambah kendaraan dengan pemegang -> detail B 5555 UJI, pemegang Putri, pemakaian aktif terbentuk');

  // Ubah kendaraan
  await page.click('a:has-text("Ubah Data")');
  if (!(await page.isDisabled('#pemegang_pns_id'))) throw new Error('pemegang harus terkunci');
  await page.fill('#warna', 'Abu-abu');
  await page.click('form button.primary');
  await toast(page, 'Data kendaraan diperbarui');
  await page.waitForSelector('dd:has-text("Abu-abu")');
  ok('Ubah kendaraan -> warna tersimpan; dropdown pemegang terkunci selama dipakai');

  // Pemakaian: tutup & tautkan dari detail
  await page.click('button:has-text("Tutup Pemakaian")');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal', { state: 'detached' });
  ok('Dialog Tutup Pemakaian -> tertutup dengan Escape');
  await page.click('button:has-text("Tutup Pemakaian")');
  await page.click('.modal button.primary');
  await toast(page, 'Pemakaian ditutup');
  await page.waitForSelector('.badge:has-text("Belum ada pemegang")');
  ok('Tutup pemakaian -> pemegang kosong, riwayat berstatus Selesai');
  await page.click('button:has-text("Tautkan Pemakai")');
  await pick(page, '.modal #pns_id', 'Ratna Juwita');
  await page.fill('.modal #keterangan', 'Uji tautkan');
  await page.click('.modal button.primary');
  await toast(page, 'Pemakai kendaraan ditautkan');
  await page.waitForSelector('dd a:has-text("Ratna Juwita")');
  ok('Tautkan pemakai -> Ratna Juwita Lestari menjadi pemegang');

  // Perawatan dari detail
  await page.click('button:has-text("Catat Perawatan")');
  await page.selectOption('.modal #jenis_perawatan', 'perbaikan');
  await page.fill('.modal #biaya', '-1');
  await page.click('.modal button.primary');
  await page.waitForSelector('.modal .field-error');
  ok('Perawatan biaya negatif -> validasi field biaya');
  await page.fill('.modal #biaya', '750000');
  await page.selectOption('.modal #kondisi_setelah', 'rusak_ringan');
  await page.fill('.modal #bengkel', 'Bengkel uji');
  await page.click('.modal button.primary');
  await toast(page, 'Perawatan dicatat');
  await page.waitForSelector('h1 .badge:has-text("Rusak Ringan")');
  await page.waitForSelector('.stat .value:has-text("Rp750.000")');
  ok('Catat perawatan -> kondisi kendaraan menjadi Rusak Ringan, total biaya Rp750.000');
  await page.click('td.row-actions button:has-text("Ubah")');
  await page.selectOption('.modal #kondisi_setelah', 'baik');
  await page.click('.modal button.primary');
  await toast(page, 'Catatan perawatan diperbarui');
  await page.waitForSelector('h1 .badge:has-text("Baik")');
  ok('Ubah catatan perawatan -> kondisi kembali Baik');
  await page.click('td.row-actions button:has-text("Hapus")');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('.empty:has-text("Belum ada catatan perawatan")');
  ok('Hapus catatan perawatan (konfirmasi) -> daftar kosong');

  // Hapus kendaraan
  await page.click('.page-head button.danger');
  await page.waitForSelector('.modal:has-text("B 5555 UJI")');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('h1:has-text("Kendaraan Dinas")');
  ok('Hapus kendaraan -> konfirmasi menyebut nomor polisi, kembali ke daftar');

  // PNS
  await page.goto(BASE + '#/pns/baru');
  await page.fill('#nip', '123');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error:has-text("18 digit")');
  ok('PNS NIP 3 digit -> "NIP harus 18 digit angka"');
  await page.fill('#nip', '199912312020121001');
  await page.fill('#nama_pegawai', 'Pegawai Uji');
  await page.fill('#jabatan', 'Staf');
  await pick(page, '#perangkat_daerah_id', 'Dinas Bina Marga');
  await page.selectOption('#golongan', 'III/a');
  await page.selectOption('#status_kepegawaian', 'pensiun');
  await page.click('form button.primary');
  await page.waitForSelector('h1:has-text("Pegawai Uji")');
  ok('Tambah PNS berstatus pensiun -> detail Pegawai Uji');
  await page.goto(BASE + '#/pns');
  await page.selectOption('label.filter:has-text("Status") select', 'pensiun');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 1);
  ok('Filter status pensiun -> 1 PNS');
  await page.click('tbody a:has-text("Pegawai Uji")');
  await page.click('.page-head button.danger');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('h1:has-text("PNS")');
  ok('Hapus PNS tanpa kendaraan -> kembali ke daftar');

  // Perangkat daerah: hapus ditolak 409, tambah & hapus
  await page.goto(BASE + '#/perangkat-daerah/18');
  await page.click('.page-head button.danger');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('.modal .alert.error:has-text("tidak dapat dihapus")');
  await page.click('.modal button:has-text("Tutup")');
  ok('Hapus perangkat daerah berelasi -> 409 dijelaskan di dialog');
  await page.goto(BASE + '#/perangkat-daerah/baru');
  await page.fill('#kode', 'pd-099');
  await page.fill('#nama_dinas', 'Dinas Uji Coba');
  await page.fill('#email', 'bukan-email');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error:has-text("Format Email")');
  await page.fill('#email', '');
  await page.click('form button.primary');
  await page.waitForSelector('h1:has-text("Dinas Uji Coba")');
  await page.click('.page-head button.danger');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('h1:has-text("Perangkat Daerah")');
  ok('Perangkat daerah: validasi email, tambah PD-099, hapus');

  // Halaman Pemakai Kendaraan
  await page.goto(BASE + '#/pemakaian');
  await page.click('tr:has-text("B 3871 PQD") button:has-text("Tutup")');
  await page.click('.modal button.primary');
  await toast(page, 'Pemakaian ditutup');
  await page.click('.page-head button.primary');
  await pick(page, '.modal #kdo_id', 'B 3871 PQD');
  await pick(page, '.modal #pns_id', 'Putri Ayu Anggraini');
  await page.click('.modal button.primary');
  await toast(page, 'Pemakai kendaraan ditautkan');
  ok('Menu Pemakai Kendaraan: tutup pemakaian B 3871 PQD, lalu tautkan ke Putri');

  // Perawatan (tab)
  await page.goto(BASE + '#/perawatan');
  await page.waitForSelector('.empty:has-text("Belum ada jadwal servis"), tbody tr');
  await page.click('[role=tab]:has-text("Rekap Biaya")');
  await page.waitForSelector('tfoot:has-text("Total seluruh kendaraan"), .empty:has-text("Belum ada biaya perawatan")');
  await page.click('[role=tab]:has-text("Semua Catatan")');
  await page.click('button:has-text("Catat Perawatan")');
  await page.keyboard.press('Escape');
  ok('Perawatan: tab Jadwal, Rekap Biaya, Semua Catatan + dialog catat');

  // Laporan
  await page.goto(BASE + '#/laporan');
  await page.waitForSelector('.report-summary:has-text("Total kendaraan")');
  await page.selectOption('label.filter:has-text("Kondisi") select', 'rusak_berat');
  await page.waitForSelector('.report-summary:has-text("2 unit")');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Unduh PDF")')]);
  const [xlsx] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Unduh Excel")')]);
  if (!/^laporan-kendaraan-.*\.pdf$/.test(pdf.suggestedFilename()) || !/\.xlsx$/.test(xlsx.suggestedFilename())) throw new Error('nama berkas');
  if (fs.statSync(await pdf.path()).size < 1000 || fs.statSync(await xlsx.path()).size < 1000) throw new Error('berkas kosong');
  ok(`Laporan kendaraan tersaring rusak berat -> unduh ${pdf.suggestedFilename()} & ${xlsx.suggestedFilename()}`);
  await page.evaluate(() => { window.__printed = false; window.print = () => (window.__printed = true); });
  await page.click('button:has-text("Cetak")');
  if (!(await page.evaluate(() => window.__printed))) throw new Error('print');
  ok('Tombol Cetak -> memanggil dialog cetak browser');
  await page.click('[role=tab]:has-text("Pemakaian Kendaraan")');
  await page.fill('label.filter:has-text("Sampai") input', '2000-01-01');
  await page.waitForSelector('.empty:has-text("Tidak ada data")');
  if (!(await page.isDisabled('button:has-text("Unduh PDF")'))) throw new Error('unduh harus nonaktif');
  ok('Laporan pemakaian periode kosong -> pesan jelas, tombol cetak/unduh nonaktif');
  await page.click('[role=tab]:has-text("Perawatan Kendaraan")');
  await page.waitForSelector('.report-summary:has-text("Total biaya keseluruhan"), .empty:has-text("Tidak ada data")');
  ok('Laporan perawatan -> total keseluruhan, atau pesan jelas bila belum ada servis');

  // Pengguna
  await page.goto(BASE + '#/pengguna');
  await page.click('.page-head button.primary');
  await page.fill('.modal #nama', 'Pengguna Uji');
  await page.fill('.modal #email', 'admin@kdo.test');
  await page.fill('.modal #password', 'rahasia123');
  await page.click('.modal button.primary');
  await page.waitForSelector('.modal .field-error:has-text("sudah terdaftar")');
  await page.fill('.modal #email', 'uji@kdo.test');
  await page.click('.modal button.primary');
  await toast(page, 'Pengguna ditambahkan');
  await page.click('tr:has-text("uji@kdo.test") button:has-text("Ubah")');
  await page.uncheck('.modal #is_active');
  await page.click('.modal button.primary');
  await page.waitForSelector('tr:has-text("uji@kdo.test") .badge:has-text("Nonaktif")');
  ok('Kelola pengguna: email ganda ditolak, tambah, nonaktifkan');

  // Pengaturan
  await page.goto(BASE + '#/pengaturan');
  await page.fill('#pengingat_servis_hari', '0');
  await page.click('form > .actions button.primary');
  await page.waitForSelector('.field-error:has-text("minimal 1")');
  await page.fill('#pengingat_servis_hari', '21');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  await page.setInputFiles('#logo', { name: 'logo.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('.kop.preview img');
  await page.click('form > .actions button.primary');
  await toast(page, 'Pengaturan disimpan');
  ok('Pengaturan: validasi, unggah logo (pratinjau kop), simpan');

  await page.click('nav a:has-text("Rancangan Database")');
  await page.waitForSelector('.alert.info:has-text("rancangan database untuk sistem SI-KDO")');
  if ((await page.locator('svg.erd g[transform]').count()) !== 9) throw new Error('ERD harus memuat 9 tabel');
  const [ddl] = await Promise.all([page.waitForEvent('download'), page.click('a:has-text("Unduh DDL MySQL")')]);
  if (!fs.readFileSync(await ddl.path(), 'utf8').includes('CREATE TABLE kdo (')) throw new Error('DDL');
  await page.click('details.dict summary:has-text("kdo_perawatan")');
  await page.waitForSelector('details.dict[open] td:has-text("jadwal_berikutnya")');
  ok('Rancangan Database: catatan rancangan, ERD 9 tabel, unduh DDL MySQL, buka kamus data kdo_perawatan');

  await page.goto(BASE + '#/log');
  await page.waitForSelector('td:has-text("TAMBAH")');
  ok('Log aktivitas -> mencatat aksi');

  // Keyboard: fokus terlihat
  await page.goto(BASE + '#/kdo');
  await page.keyboard.press('Tab');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  if (outline === 'none') throw new Error('focus outline');
  ok(`Tab pertama -> fokus terlihat (outline ${outline})`);

  await page.click('button:has-text("Keluar")');
  await page.waitForSelector('#email');
  ok('Keluar -> kembali ke halaman masuk');

  // Petugas lapangan: hanya lihat
  await login(page, 'petugas@kdo.test', 'petugas12345');
  await page.waitForSelector('h1:has-text("Dashboard Kendaraan")');
  await page.goto(BASE + '#/kdo/1');
  await page.waitForSelector('h1:has-text("B 1426 PQA")');
  if (await page.locator('a:has-text("Ubah Data"), .page-head button.danger').count()) throw new Error('petugas melihat tombol ubah');
  await page.goto(BASE + '#/pengguna');
  await page.waitForSelector('h1:has-text("Akses ditolak")');
  ok('Petugas: tombol ubah/hapus tidak tampil, halaman admin -> "Akses ditolak"');

  // Ponsel: menu
  const mobile = await browser.newContext({ ...devices['iPhone 13'] });
  const m = await mobile.newPage();
  await login(m, 'admin@kdo.test', 'admin12345');
  await m.waitForSelector('h1:has-text("Dashboard Kendaraan")');
  if (await m.isVisible('nav#menu-utama')) throw new Error('menu harus tertutup');
  await m.click('button.menu-toggle');
  await m.click('nav#menu-utama a:has-text("Laporan & Cetak")');
  await m.waitForSelector('h1:has-text("Laporan & Cetak")');
  if (await m.isVisible('nav#menu-utama')) throw new Error('menu harus menutup setelah navigasi');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 0) throw new Error(`overflow ${overflow}px`);
  ok('Ponsel: tombol Menu membuka navigasi, menutup setelah pindah halaman, tanpa scroll horizontal');

  if (errors.length) throw new Error('Console error: ' + errors.join(' | '));
  ok('Tidak ada error di console');
  await browser.close();
  console.log(`\n${log.length} langkah lulus.`);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
