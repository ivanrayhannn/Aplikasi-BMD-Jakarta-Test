// Membangun versi statis SI-KDO untuk GitHub Pages ke folder dist/.
// Backend dijalankan di browser (demo/backend.js + sql.js) memakai src/api yang sama dengan server.
import { rmSync, mkdirSync, cpSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { VENDOR } from '../src/server/app.js';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/vendor`, { recursive: true });

cpSync('public', out, { recursive: true });
writeFileSync(`${out}/config.js`, "export default { mode: 'demo', sampleData: true };\n");
for (const [name, from] of Object.entries(VENDOR)) cpSync(from, `${out}/vendor/${name}`);
cpSync('src/shared', `${out}/lib/shared`, { recursive: true });
cpSync('src/api', `${out}/lib/api`, { recursive: true });
cpSync('demo/backend.js', `${out}/demo-backend.js`);
cpSync('db/mysql', `${out}/db`, { recursive: true });
writeFileSync(`${out}/.nojekyll`, '');

// Versi sebelum revisi alur menu dipasang di dist/lama/ agar pengguna bisa membandingkan selama UAT.
// Hapus blok ini setelah revisi disetujui. Butuh riwayat git (checkout fetch-depth: 0).
const LAMA_REF = 'e5647ca';
const tmp = '.lama-build';
try {
  execSync(`git cat-file -e ${LAMA_REF}^{commit}`, { stdio: 'ignore' });
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp);
  execSync(`git archive ${LAMA_REF} | tar -x -C ${tmp}`);
  symlinkSync(resolve('node_modules'), `${tmp}/node_modules`, 'dir');
  execSync('node scripts/build-pages.mjs', { cwd: tmp, stdio: 'ignore' });
  cpSync(`${tmp}/dist`, `${out}/lama`, { recursive: true });
  const index = `${out}/lama/index.html`;
  writeFileSync(index, readFileSync(index, 'utf8').replace('<body>', '<body>\n  <p style="margin:0;padding:10px 16px;background:#fff3c4;color:#1d2327;font:14px/1.4 sans-serif">'
    + 'Versi lama (sebelum revisi alur menu), hanya untuk perbandingan. <a href="../" style="color:#23458f">Buka versi baru</a></p>'));
  console.log('Versi lama dipasang di dist/lama/');
} catch {
  console.warn('Versi lama dilewati: commit pembanding tidak tersedia di riwayat git');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`Build GitHub Pages selesai: ${out}/`);
