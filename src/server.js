import { openDatabase } from './db.js';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const dbFile = process.env.DB_FILE ?? 'data/kdo.db';

const db = openDatabase(dbFile);
createApp(db).listen(port, () => {
  console.log(`Aplikasi KDO berjalan di http://localhost:${port} (database: ${dbFile})`);
});
