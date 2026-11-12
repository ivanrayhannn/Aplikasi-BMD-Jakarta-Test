import { openDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const dbFile = process.env.DB_FILE ?? 'data/kdo.db';
// SEED_SAMPLE=0 untuk produksi: database baru hanya berisi data wajib (36 SKPD dan akun admin).
const sampleData = process.env.SEED_SAMPLE !== '0';

createApp(openDatabase(dbFile, { sampleData })).listen(port, () => {
  console.log(`Aplikasi KDO berjalan di http://localhost:${port} (database: ${dbFile})`);
});
