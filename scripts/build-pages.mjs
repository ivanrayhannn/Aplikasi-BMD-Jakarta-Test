// Membangun versi statis SI-KDO untuk GitHub Pages ke folder dist/.
// Backend dijalankan di browser (demo/backend.js + sql.js) memakai src/api.js yang sama dengan server.
import { rmSync, mkdirSync, cpSync, writeFileSync } from 'node:fs';

const out = 'dist';
rmSync(out, { recursive: true, force: true });
mkdirSync(`${out}/vendor`, { recursive: true });
mkdirSync(`${out}/lib`, { recursive: true });

cpSync('public', out, { recursive: true });
writeFileSync(`${out}/config.js`, "export default { mode: 'demo' };\n");
cpSync('node_modules/vue/dist/vue.esm-browser.prod.js', `${out}/vendor/vue.js`);
cpSync('node_modules/sql.js/dist/sql-wasm.js', `${out}/vendor/sql-wasm.js`);
cpSync('node_modules/sql.js/dist/sql-wasm.wasm', `${out}/vendor/sql-wasm.wasm`);
cpSync('src/api.js', `${out}/lib/api.js`);
cpSync('src/schema.js', `${out}/lib/schema.js`);
cpSync('demo/backend.js', `${out}/demo-backend.js`);
writeFileSync(`${out}/.nojekyll`, '');
console.log(`Build GitHub Pages selesai: ${out}/`);
