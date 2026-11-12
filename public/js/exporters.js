// Ekspor laporan ke PDF (jsPDF + autotable) dan Excel (ExcelJS).
// Keduanya menerima objek laporan yang sama dengan pratinjau di layar → isi & angka identik (fitur 05).
// Pustaka dimuat saat dibutuhkan saja agar halaman tetap ringan.

/**
 * @typedef {{ label: string, align?: 'left'|'right'|'center' }} Column
 * @typedef {{ title: string, periode?: string, kop: { nama_instansi: string, alamat?: string, logo_url?: string },
 *   dicetakPada: string, columns: Column[], rows: string[][], summary: [string, string][], filename: string }} Report
 */

const loaded = new Map();
function loadScript(src) {
  if (!loaded.has(src)) {
    loaded.set(src, new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement('script'), { src, onload: resolve, onerror: () => reject(new Error(`Gagal memuat ${src}`)) });
      document.head.append(s);
    }));
  }
  return loaded.get(src);
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const imageFormat = (dataUrl) => /^data:image\/(png|jpeg)/.exec(dataUrl ?? '')?.[1] ?? null; // SVG tidak didukung di PDF/Excel

/** @param {Report} report */
export async function exportPdf(report) {
  await loadScript('vendor/jspdf.umd.min.js');
  await loadScript('vendor/jspdf.plugin.autotable.min.js');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const margin = 14;
  let x = margin;

  const fmt = imageFormat(report.kop.logo_url);
  if (fmt) { doc.addImage(report.kop.logo_url, fmt.toUpperCase(), margin, 10, 18, 18); x = margin + 22; }
  doc.setFont('helvetica', 'bold').setFontSize(13).text(report.kop.nama_instansi, x, 16);
  doc.setFont('helvetica', 'normal').setFontSize(9).text(report.kop.alamat ?? '', x, 21);
  doc.setLineWidth(0.6).line(margin, 30, width - margin, 30);

  doc.setFont('helvetica', 'bold').setFontSize(12).text(report.title.toUpperCase(), width / 2, 38, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9);
  if (report.periode) doc.text(`Periode: ${report.periode}`, width / 2, 43, { align: 'center' });
  doc.text(`Tanggal cetak: ${report.dicetakPada}`, width - margin, 48, { align: 'right' });

  const columnStyles = Object.fromEntries(report.columns.map((c, i) => [i, { halign: c.align ?? 'left' }]));
  doc.autoTable({
    startY: 51, head: [report.columns.map((c) => c.label)], body: report.rows, columnStyles,
    styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: [11, 79, 138] }, margin: { left: margin, right: margin },
  });
  if (report.summary.length) {
    doc.autoTable({
      startY: doc.lastAutoTable.finalY + 4, body: report.summary, theme: 'plain', tableWidth: 120,
      styles: { fontSize: 9, cellPadding: 1 }, columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' } }, margin: { left: margin },
    });
  }
  const signY = Math.min(doc.lastAutoTable.finalY + 12, doc.internal.pageSize.getHeight() - 32);
  doc.setFontSize(9).text([`Jakarta, ${report.dicetakPada}`, 'Pengelola Aset', '', '', '', '(...................................)'], width - margin - 60, signY);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i).setFontSize(8).text(`Halaman ${i} dari ${pages}`, width - margin, doc.internal.pageSize.getHeight() - 6, { align: 'right' });
  }
  doc.save(`${report.filename}.pdf`);
}

/** @param {Report} report */
export async function exportExcel(report) {
  await loadScript('vendor/exceljs.min.js');
  const wb = new window.ExcelJS.Workbook();
  wb.creator = report.kop.nama_instansi;
  const ws = wb.addWorksheet(report.title.slice(0, 31), { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
  const lastCol = report.columns.length;
  const merge = (row) => ws.mergeCells(row, 1, row, lastCol);

  const fmt = imageFormat(report.kop.logo_url);
  const startCol = fmt ? 2 : 1;
  if (fmt) {
    const img = wb.addImage({ base64: report.kop.logo_url, extension: fmt });
    ws.addImage(img, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
  }
  ws.getCell(1, startCol).value = report.kop.nama_instansi;
  ws.getCell(1, startCol).font = { bold: true, size: 14 };
  ws.getCell(2, startCol).value = report.kop.alamat ?? '';
  ws.getCell(4, 1).value = report.title.toUpperCase();
  ws.getCell(4, 1).font = { bold: true, size: 12 };
  ws.getCell(4, 1).alignment = { horizontal: 'center' };
  merge(4);
  ws.getCell(5, 1).value = [report.periode ? `Periode: ${report.periode}` : '', `Tanggal cetak: ${report.dicetakPada}`].filter(Boolean).join('   ·   ');
  ws.getCell(5, 1).alignment = { horizontal: 'center' };
  merge(5);

  const header = ws.getRow(7);
  report.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B4F8A' } };
    cell.alignment = { horizontal: c.align ?? 'left', vertical: 'middle', wrapText: true };
  });
  report.rows.forEach((r, ri) => {
    const row = ws.getRow(8 + ri);
    r.forEach((v, ci) => {
      const cell = row.getCell(ci + 1);
      cell.value = v;
      cell.alignment = { horizontal: report.columns[ci].align ?? 'left', vertical: 'top', wrapText: true };
      cell.border = { bottom: { style: 'hair', color: { argb: 'FFDFE3EA' } } };
    });
  });
  let r = 8 + report.rows.length + 1;
  for (const [k, v] of report.summary) {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { bold: true };
    ws.getCell(r, lastCol).value = v;
    ws.getCell(r, lastCol).alignment = { horizontal: 'right' };
    r += 1;
  }
  report.columns.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...report.rows.map((row) => String(row[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(45, Math.max(8, longest + 2));
  });

  const buffer = await wb.xlsx.writeBuffer();
  download(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${report.filename}.xlsx`);
}
