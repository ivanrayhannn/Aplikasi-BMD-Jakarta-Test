// Membangun versi statis SI-KDO untuk GitHub Pages ke folder dist/.
// Backend dijalankan di browser (demo/backend.js + sql.js) memakai src/api yang sama dengan server.
import { rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';
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
console.log(`Build GitHub Pages selesai: ${out}/`);
