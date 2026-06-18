import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../../migrations');

async function migrate() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.execute(`USE \`${process.env.DB_NAME}\``);

  await conn.execute(`CREATE TABLE IF NOT EXISTS _migrations (
    id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    filename   VARCHAR(255) NOT NULL UNIQUE,
    run_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const [ran] = await conn.execute('SELECT filename FROM _migrations');
  const ranSet = new Set(ran.map(r => r.filename));

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (ranSet.has(file)) { console.log(`  skip: ${file}`); continue; }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const stmt of statements) {
      await conn.execute(stmt);
    }
    await conn.execute('INSERT INTO _migrations (filename) VALUES (?)', [file]);
    console.log(`  ran:  ${file}`);
  }

  await conn.end();
  console.log('Migrations complete.');
}

migrate().catch(err => { console.error(err); process.exit(1); });
