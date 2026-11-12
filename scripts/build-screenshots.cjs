// Membangun workbook bukti UI gaya Crossdock: docs/screenshots/KDO-Screenshots.xlsx.
// Satu lembar per alur; tiap baris berisi No, Langkah, Aksi, Hasil yang Diharapkan, URL, dan screenshot.
// Jalankan pada server dengan database baru berisi data contoh:
//   rm -rf data && npm start   (terminal lain)   node scripts/build-screenshots.cjs [baseUrl]
// Butuh paket `playwright` beserta Chromium yang sudah terpasang.
const { chromium, devices } = require('playwright');
const ExcelJS = require('exceljs');
const { mkdirSync } = require('node:fs');

const BASE = process.argv[2] || 'http://localhost:3000/';
const OUT = 'docs/screenshots/KDO-Screenshots.xlsx';
const IMG_W = 560; // lebar gambar di Excel (px)

/** Pilih opsi <select> yang teksnya memuat `text`, menunggu opsi termuat. */
async function pick(page, selector, text) {
  const handle = await page.waitForFunction(([sel, t]) => {
    const el = document.querySelector(sel);
    return el && [...el.options].find((o) => o.text.includes(t))?.value;
  }, [selector, text]);
  await page.selectOption(selector, await handle.jsonValue());
}

async function login(page, email, password) {
  await page.goto(BASE);
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('form button.primary');
  await page.waitForSelector('main h1');
}

(async () => {
  const browser = await chromium.launch();
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  page.on('dialog', (d) => d.accept());

  /** @type {{ sheet: string, steps: { action: string, expected: string, url: string, image: Buffer, w: number, h: number }[] }[]} */
  const flows = [];
  let current;
  const flow = (sheet) => { current = { sheet, steps: [] }; flows.push(current); };
  const shot = async (action, expected, { target = page, full = false } = {}) => {
    await target.waitForTimeout(350);
    const image = await target.screenshot({ type: 'jpeg', quality: 72, fullPage: full });
    const vp = target.viewportSize();
    const h = full ? await target.evaluate(() => document.documentElement.scrollHeight) : vp.height;
    current.steps.push({ action, expected, url: target.url().replace(BASE, '/'), image, w: vp.width, h });
  };

  flow('01 Masuk & Dashboard');
  await page.goto(BASE);
  await page.waitForSelector('#email');
  await shot('Buka aplikasi', 'Halaman masuk dengan email, kata sandi, dan akun uji coba');
  await page.fill('#email', 'admin@kdo.test');
  await page.fill('#password', 'salah123');
  await page.click('form button.primary');
  await page.waitForSelector('.alert.error');
  await shot('Masuk dengan kata sandi salah', 'Pesan "Email atau kata sandi salah", tetap di halaman masuk');
  await page.fill('#password', 'admin12345');
  await page.click('form button.primary');
  await page.waitForSelector('h1:has-text("Dashboard")');
  await shot('Masuk sebagai Pengelola Aset', 'Dashboard: total aset, sedang dipakai, kondisi, aset terbaru, pengingat', { full: true });

  flow('02 Perangkat Daerah');
  await page.goto(BASE + '#/perangkat-daerah');
  await page.waitForSelector('tbody tr');
  await shot('Buka menu Perangkat Daerah', 'Daftar 36 SKPD dengan jumlah PNS dan KDO, berpaginasi');
  await page.goto(BASE + '#/perangkat-daerah/baru');
  await page.fill('#kode', 'SKPD-18');
  await page.fill('#nama_dinas', 'Dinas Perhubungan');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error');
  await shot('Simpan dengan kode dan nama yang sudah ada', 'Ditolak 422, pesan di field kode dan nama dinas');
  await page.goto(BASE + '#/perangkat-daerah/18');
  await page.waitForSelector('h1:has-text("Dinas Perhubungan")');
  await shot('Buka detail Dinas Perhubungan', 'Data unit, daftar PNS dan kendaraan milik unit');
  await page.click('.page-head button.danger');
  await page.click('.modal button.danger-solid');
  await page.waitForSelector('.modal .alert.error');
  await shot('Hapus unit yang masih punya PNS/KDO', 'Ditolak 409, dialog menjelaskan jumlah PNS dan kendaraan penghalang');

  flow('03 PNS');
  await page.goto(BASE + '#/pns');
  await page.waitForSelector('tbody tr');
  await shot('Buka menu PNS', 'Daftar pegawai dengan filter status dan unit kerja');
  await page.goto(BASE + '#/pns/baru');
  await page.fill('#nip', '12345');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error');
  await shot('Simpan form dengan NIP 5 digit', 'Pesan per field: NIP 18 digit, field wajib lain');
  await page.goto(BASE + '#/pns/1');
  await page.waitForSelector('h1:has-text("Bambang")');
  await shot('Buka detail PNS', 'Kendaraan yang dipegang dan riwayat pemakaian', { full: true });
  await page.click('.page-head button.danger');
  await page.waitForSelector('.modal');
  await shot('Klik Hapus pada PNS pemegang kendaraan', 'Dialog memperingatkan kendaraan yang akan dilepas');
  await page.keyboard.press('Escape');

  flow('04 Kendaraan Dinas');
  await page.goto(BASE + '#/kdo');
  await page.waitForSelector('tbody tr');
  await shot('Buka menu Kendaraan Dinas', 'Daftar kendaraan: nomor polisi, merek/tipe, jenis, unit, kondisi, pemegang');
  await page.selectOption('label.filter:has-text("Kondisi") select', 'rusak_berat');
  await page.waitForFunction(() => document.querySelectorAll('tbody tr').length === 2);
  await shot('Saring kondisi Rusak Berat', 'Hanya kendaraan rusak berat yang tampil');
  await page.goto(BASE + '#/kdo/baru');
  await page.waitForSelector('#nomor_polisi');
  await shot('Klik Tambah Kendaraan', 'Form berkelompok: identitas, legalitas, nilai & aset, penempatan', { full: true });
  await page.fill('#nomor_polisi', 'B 1426 PQA');
  await page.fill('#merek', 'Toyota');
  await page.fill('#nomor_rangka', 'X1');
  await page.fill('#nomor_mesin', 'Y1');
  await pick(page, '#perangkat_daerah_id', 'Dinas Kesehatan');
  await page.click('form button.primary');
  await page.waitForSelector('.field-error:has-text("sudah terdaftar")');
  await page.locator('#nomor_polisi').scrollIntoViewIfNeeded();
  await shot('Simpan dengan nomor polisi yang sudah ada', 'Ditolak 422, pesan di field nomor polisi');
  await page.goto(BASE + '#/kdo/1');
  await page.waitForSelector('h1:has-text("B 1426 PQA")');
  await shot('Buka detail B 1426 PQA', 'Seluruh atribut, jatuh tempo STNK/pajak, pemegang, riwayat perawatan dan pemakaian', { full: true });
  await page.click('.page-head button.danger');
  await page.waitForSelector('.modal');
  await shot('Klik Hapus kendaraan', 'Konfirmasi menyebut nomor polisi dan jumlah riwayat yang ikut terhapus');
  await page.keyboard.press('Escape');

  flow('05 Pemakai Kendaraan');
  await page.goto(BASE + '#/pemakaian');
  await page.waitForSelector('tbody tr');
  await shot('Buka menu Pemakai Kendaraan', 'Pemakaian aktif di atas, riwayat selesai di bawah');
  await page.click('tr:has-text("B 3871 PQD") button:has-text("Tutup")');
  await page.waitForSelector('.modal');
  await shot('Klik Tutup pada pemakaian aktif B 3871 PQD', 'Dialog tanggal selesai; setelah disimpan status menjadi Selesai');
  await page.click('.modal button.primary');
  await page.waitForSelector('.toast');
  await page.click('.page-head button.primary');
  await pick(page, '.modal #kdo_id', 'B 3871 PQD');
  await pick(page, '.modal #pns_id', 'Putri Ayu Anggraini');
  await shot('Klik Tautkan Pemakai, pilih kendaraan dan pegawai', 'Dialog hanya menawarkan kendaraan tanpa pemakai dan PNS aktif');
  await page.click('.modal button.primary');

  flow('06 Riwayat Perawatan');
  await page.goto(BASE + '#/kdo/5');
  await page.waitForSelector('h1');
  await page.click('button:has-text("Catat Perawatan")');
  await page.selectOption('.modal #jenis_perawatan', 'perbaikan');
  await page.fill('.modal #biaya', '4750000');
  await page.fill('.modal #bengkel', 'Bengkel rekanan Dinas LH');
  await page.fill('.modal #deskripsi', 'Perbaikan sistem hidrolik compactor');
  await page.selectOption('.modal #kondisi_setelah', 'rusak_ringan');
  await page.fill('.modal #jadwal_berikutnya', new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10));
  await shot('Detail B 9512 PQC, klik Catat Perawatan dan isi form', 'Dialog tanggal, jenis, bengkel, biaya, kondisi setelah servis, jadwal berikutnya');
  await page.click('.modal button.primary');
  await page.waitForSelector('.toast');
  await page.goto(BASE + '#/perawatan');
  await page.waitForSelector('tbody tr');
  await shot('Buka menu Riwayat Perawatan', 'Tab Jadwal Servis: B 9512 PQC berlabel Segera servis');
  await page.click('[role=tab]:has-text("Rekap Biaya")');
  await page.waitForSelector('tfoot');
  await shot('Buka tab Rekap Biaya', 'Total biaya per kendaraan, urut terbesar, dengan total keseluruhan');

  flow('07 Laporan & Cetak');
  for (const [tab, expected] of [
    ['Daftar Kendaraan Dinas', 'Kop instansi, tabel kendaraan, ringkasan per kondisi dan total'],
    ['Pemakaian Kendaraan', 'Pemakaian per periode, "Masih berjalan" untuk yang aktif'],
    ['Perawatan Kendaraan', 'Riwayat servis, total biaya per kendaraan dan keseluruhan'],
  ]) {
    await page.goto(BASE + '#/laporan');
    await page.click(`[role=tab]:has-text("${tab}")`);
    await page.waitForSelector('.report-summary');
    await shot(`Pilih laporan ${tab}`, expected, { full: true });
  }
  await page.click('[role=tab]:has-text("Pemakaian Kendaraan")');
  await page.fill('label.filter:has-text("Sampai") input', '2000-01-01');
  await page.waitForSelector('.empty');
  await shot('Saring periode tanpa data', 'Pesan jelas; tombol Cetak, Unduh PDF, Unduh Excel nonaktif');

  flow('08 Pengguna & Pengaturan');
  await page.goto(BASE + '#/pengguna');
  await page.waitForSelector('tbody tr');
  await shot('Buka Kelola Pengguna', 'Daftar akun dengan peran dan status');
  await page.click('.page-head button.primary');
  await page.waitForSelector('.modal');
  await shot('Klik Tambah Pengguna', 'Form nama, email, peran, pegawai terkait, kata sandi awal, status');
  await page.keyboard.press('Escape');
  await page.goto(BASE + '#/pengaturan');
  await page.waitForSelector('#nama_instansi');
  await shot('Buka Pengaturan', 'Data instansi dengan pratinjau kop, pengingat, pilihan terkendali', { full: true });
  await page.goto(BASE + '#/log');
  await page.waitForSelector('tbody tr');
  await shot('Buka Log Aktivitas', 'Jejak audit: waktu, pengguna, aksi, data, detail');

  flow('09 Rancangan Database');
  await page.goto(BASE + '#/rancangan-db');
  await page.waitForSelector('svg.erd');
  await shot('Buka menu Rancangan Database', 'Catatan bahwa halaman ini rancangan DB, ringkasan tabel/relasi, ERD');
  await page.locator('.erd-wrap').scrollIntoViewIfNeeded();
  await shot('Gulir ke diagram ERD', '9 tabel, 8 relasi dengan aturan ON DELETE dan notasi crow\'s foot');
  await page.locator('h2:has-text("Kamus data")').scrollIntoViewIfNeeded();
  await shot('Gulir ke Kamus data', 'Setiap tabel: kolom, tipe MySQL, kunci, boleh kosong, keterangan');

  flow('10 Hak Akses & Ponsel');
  await page.click('button:has-text("Keluar")');
  await login(page, 'petugas@kdo.test', 'petugas12345');
  await page.goto(BASE + '#/kdo/1');
  await page.waitForSelector('h1:has-text("B 1426 PQA")');
  await shot('Masuk sebagai Petugas Lapangan, buka detail kendaraan', 'Tanpa tombol Ubah, Hapus, Tautkan, Catat Perawatan');
  await page.goto(BASE + '#/pengguna');
  await page.waitForSelector('h1:has-text("Akses ditolak")');
  await shot('Buka alamat #/pengguna sebagai petugas', 'Pesan "Akses ditolak", bukan data');
  const phoneCtx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 });
  const phone = await phoneCtx.newPage();
  await login(phone, 'admin@kdo.test', 'admin12345');
  await phone.goto(BASE + '#/kdo');
  await phone.waitForSelector('tbody tr');
  await shot('Buka Kendaraan Dinas di ponsel', 'Filter dua kolom, setiap kendaraan tampil sebagai kartu berlabel', { target: phone });
  await phone.click('button.menu-toggle');
  await shot('Ketuk tombol Menu', 'Navigasi terbuka; menutup otomatis setelah memilih halaman', { target: phone });

  await browser.close();
  await writeWorkbook(flows);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });

async function writeWorkbook(flows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SI-KDO';
  const border = { top: { style: 'thin', color: { argb: 'FFDFE3EA' } }, bottom: { style: 'thin', color: { argb: 'FFDFE3EA' } },
    left: { style: 'thin', color: { argb: 'FFDFE3EA' } }, right: { style: 'thin', color: { argb: 'FFDFE3EA' } } };
  const head = (row) => row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F8A' } };
    c.alignment = { vertical: 'middle', wrapText: true };
    c.border = border;
  });

  const index = wb.addWorksheet('Ringkasan');
  index.columns = [{ width: 6 }, { width: 34 }, { width: 14 }, { width: 70 }];
  index.addRow(['SI-KDO: dokumentasi layar (bukti UI)']).font = { bold: true, size: 14 };
  index.addRow([`Dibuat otomatis oleh scripts/build-screenshots.cjs pada ${new Date().toISOString().slice(0, 10)} dari aplikasi yang berjalan dengan data uji UAT DKI Jakarta.`]);
  index.addRow([]);
  head(index.addRow(['No', 'Lembar (alur)', 'Jumlah langkah', 'Isi']));
  flows.forEach((f, i) => {
    const r = index.addRow([i + 1, f.sheet, f.steps.length, f.steps.map((s) => s.action).join('; ')]);
    r.alignment = { vertical: 'top', wrapText: true };
    r.eachCell((c) => (c.border = border));
  });

  for (const f of flows) {
    const ws = wb.addWorksheet(f.sheet.slice(0, 31), { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [{ width: 5 }, { width: 28 }, { width: 34 }, { width: 20 }, { width: Math.round(IMG_W / 7) }];
    head(ws.addRow(['No', 'Aksi', 'Hasil yang Diharapkan', 'URL Halaman', 'Screenshot']));
    f.steps.forEach((s, i) => {
      const imgH = Math.min(Math.round((s.h / s.w) * IMG_W), 900);
      const row = ws.addRow([i + 1, s.action, s.expected, s.url]);
      row.height = Math.round(imgH * 0.75) + 8; // tinggi baris dalam poin
      row.alignment = { vertical: 'top', wrapText: true };
      row.eachCell({ includeEmpty: true }, (c) => (c.border = border));
      const id = wb.addImage({ buffer: s.image, extension: 'jpeg' });
      ws.addImage(id, { tl: { col: 4.05, row: row.number - 1 + 0.02 }, ext: { width: Math.round((imgH / s.h) * s.w), height: imgH }, editAs: 'oneCell' });
    });
  }

  mkdirSync('docs/screenshots', { recursive: true });
  await wb.xlsx.writeFile(OUT);
  console.log(`${OUT}: ${flows.length} lembar, ${flows.reduce((n, f) => n + f.steps.length, 0)} screenshot.`);
}
