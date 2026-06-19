import { Router } from 'express';
import { getPool } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();

const ALLOWED_KEYS = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_REDIRECT_URI',
  'OPENAI_API_KEY',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
];

router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const db = getPool();
    const placeholders = ALLOWED_KEYS.map(() => '?').join(',');
    const [rows] = await db.execute(
      'SELECT `key`, value FROM settings WHERE `key` IN (' + placeholders + ')',
      ALLOWED_KEYS
    );
    const settings = {};
    for (const key of ALLOWED_KEYS) settings[key] = '';
    for (const row of rows) settings[row.key] = row.value || '';
    res.json({ success: true, settings });
  } catch (err) { next(err); }
});

router.put('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') throw ApiError.badRequest('settings object required');

    const db = getPool();
    for (const [key, value] of Object.entries(settings)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      await db.execute(
        'INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?',
        [key, value, value]
      );
      if (value) process.env[key.toUpperCase()] = value;
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

export async function loadSettingsToEnv() {
  try {
    const db = getPool();
    const placeholders = ALLOWED_KEYS.map(() => '?').join(',');
    const [rows] = await db.execute(
      'SELECT `key`, value FROM settings WHERE `key` IN (' + placeholders + ') AND value IS NOT NULL AND value != ""',
      ALLOWED_KEYS
    );
    for (const row of rows) {
      process.env[row.key.toUpperCase()] = row.value;
    }
    if (rows.length) console.log(`[settings] Loaded ${rows.length} keys from DB into env`);
  } catch (err) {
    console.warn('[settings] Could not load settings from DB:', err.message);
  }
}

export default router;
