import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const [existing] = await conn.execute("SELECT id FROM users WHERE email = 'admin@odm.in'");
  if (existing.length) {
    console.log('Seed already applied — admin exists.');
    await conn.end();
    return;
  }

  const hash = await bcrypt.hash('Admin@1234', 12);
  const [result] = await conn.execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('ODM Admin', 'admin@odm.in', ?, 'admin')",
    [hash]
  );
  console.log(`Created admin user: admin@odm.in / Admin@1234 (id=${result.insertId})`);
  console.log('IMPORTANT: Change the password immediately after first login.');

  // Sample clients
  const clients = [
    ['SFC Group of Institutions', null, 'Education'],
    ['Kaura Nursing Home',        null, 'Healthcare'],
    ['PTE Fly Moga',              null, 'Immigration'],
    ['2M Immigration Services',   null, 'Immigration'],
    ['Oslo Cafe',                 null, 'F&B'],
  ];
  for (const [name, logo, industry] of clients) {
    await conn.execute(
      'INSERT IGNORE INTO clients (name, logo_url, industry, created_by) VALUES (?, ?, ?, ?)',
      [name, logo, industry, result.insertId]
    );
  }
  console.log('Sample clients inserted.');

  await conn.end();
  console.log('Seed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
