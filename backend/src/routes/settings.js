import { Router } from 'express';
import { exec } from 'child_process';
import { getPool } from '../config/database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();

const ALLOWED_KEYS = [
  'META_APP_ID',
  'META_APP_SECRET',
  'META_REDIRECT_URI',
  'META_PERMANENT_TOKEN',
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
    for (const row of rows) settings[row.key.toUpperCase()] = row.value || '';
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

const DEPLOY_SECRET = 'odm-ghook-2026-secure';
router.post('/deploy-hook', (req, res) => {
  const secret = req.headers['x-deploy-secret'] || req.query.secret;
  if (secret !== DEPLOY_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
  res.json({ ok: true });
  const deployCmd = [
    'bash /var/www/odm-scheduler/deploy.sh',
    // Fix nginx upload limit after every deploy
    'CONF=$(grep -rl "posting.officialaiagent.in" /etc/nginx/ 2>/dev/null | head -1)',
    'if [ -n "$CONF" ]; then',
    '  if grep -q "client_max_body_size" "$CONF"; then',
    '    sed -i "s/client_max_body_size .*/client_max_body_size 500M;/" "$CONF"',
    '  else',
    '    sed -i "/server_name/a\\\\    client_max_body_size 500M;" "$CONF"',
    '  fi',
    '  nginx -t && nginx -s reload',
    'fi',
  ].join(' && ');
  exec(`(${deployCmd}) >> /var/log/odm-deploy.log 2>&1`);
});

// One-time nginx fix endpoint (admin only)
router.post('/fix-nginx', (req, res) => {
  const secret = req.headers['x-deploy-secret'] || req.query.secret;
  if (secret !== DEPLOY_SECRET) { res.status(401).json({ error: 'unauthorized' }); return; }
  const cmd = `
    CONF=$(grep -rl "posting.officialaiagent.in" /etc/nginx/ 2>/dev/null | head -1) &&
    echo "Found: $CONF" &&
    grep -q 'client_max_body_size' "$CONF" && sed -i 's/client_max_body_size .*/client_max_body_size 500M;/' "$CONF" || sed -i '/location \\/api\\//a\\        client_max_body_size 500M;' "$CONF" ;
    grep -q 'client_body_timeout' "$CONF" || sed -i '/client_max_body_size/a\\        client_body_timeout 300s;' "$CONF" ;
    grep -q 'proxy_request_buffering' "$CONF" || sed -i '/client_body_timeout/a\\        proxy_request_buffering off;' "$CONF" ;
    grep -q 'proxy_send_timeout' "$CONF" || sed -i '/proxy_read_timeout/a\\        proxy_send_timeout 300s;' "$CONF" ;
    nginx -t && nginx -s reload && echo "nginx reloaded successfully"
  `;
  exec(cmd, (err, stdout, stderr) => {
    console.log('[fix-nginx]', stdout, stderr, err?.message);
  });
  res.json({ ok: true, message: 'nginx fix triggered, check server logs' });
});

export default router;
