import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { GmbService } from '../services/gmbService.js';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { getRedis } from '../config/redis.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();

// ── Step 1: Generate OAuth URL ──────────────────────────────────────────────
router.get('/oauth-url', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { clientId } = req.query;
    if (!clientId) throw ApiError.badRequest('clientId required');
    if (!process.env.GOOGLE_CLIENT_ID) throw ApiError.badRequest('GOOGLE_CLIENT_ID not configured in Settings');

    const state = crypto.randomBytes(20).toString('hex');
    const redis = getRedis();
    await redis.setex(`google:oauth:state:${state}`, 600, JSON.stringify({ clientId, userId: req.user.id }));

    const url = GmbService.getOAuthUrl(state);
    res.json({ success: true, url });
  } catch (err) { next(err); }
});

// ── Step 2: OAuth callback ──────────────────────────────────────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) return res.send(popupClose({ error: error_description || error }));
  if (!code || !state) return res.send(popupClose({ error: 'Missing code or state' }));

  try {
    const redis = getRedis();
    const stateData = await redis.get(`google:oauth:state:${state}`);
    if (!stateData) return res.send(popupClose({ error: 'OAuth state expired. Please try again.' }));

    const { clientId } = JSON.parse(stateData);
    await redis.del(`google:oauth:state:${state}`);

    // Exchange code for tokens
    const tokens = await GmbService.exchangeCode(code);
    const { access_token, refresh_token, expires_in } = tokens;

    if (!access_token) return res.send(popupClose({ error: 'Google did not return an access token' }));

    // Fetch all GMB accounts & their locations
    const accounts = await GmbService.getAccounts(access_token);
    const discovered = [];

    for (const account of accounts) {
      try {
        const locations = await GmbService.getLocations(access_token, account.name);
        for (const loc of locations) {
          discovered.push({
            locationName:    loc.name,         // e.g. "accounts/123/locations/456"
            locationTitle:   loc.title,
            locationAddress: loc.storefrontAddress?.addressLines?.join(', ') || '',
            accountName:     account.name,
            accessToken:     access_token,
            refreshToken:    refresh_token || '',
            accessExpiresAt: new Date(Date.now() + (expires_in || 3600) * 1000),
          });
        }
      } catch (err) {
        logger.warn(`Could not fetch locations for GMB account ${account.name}`, { error: err.message });
      }
    }

    // Store in Redis temporarily (5 min)
    const sessionKey = `google:discovered:${state}-result`;
    await redis.setex(sessionKey, 300, JSON.stringify({ clientId, discovered }));

    res.send(popupClose({ sessionKey, locationCount: discovered.length }));
  } catch (err) {
    logger.error('Google OAuth callback error', { error: err.message });
    res.send(popupClose({ error: err.message }));
  }
});

// ── Step 3: Get discovered locations ────────────────────────────────────────
router.get('/locations', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { sessionKey } = req.query;
    if (!sessionKey) throw ApiError.badRequest('sessionKey required');

    const redis = getRedis();
    const data = await redis.get(sessionKey);
    if (!data) throw ApiError.badRequest('Session expired. Please reconnect.');

    const { clientId, discovered } = JSON.parse(data);
    res.json({ success: true, clientId, discovered });
  } catch (err) { next(err); }
});

// ── Step 4: Confirm and save selected locations ──────────────────────────────
router.post('/connect', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { sessionKey, selectedLocationNames, clientId } = req.body;
    if (!sessionKey || !selectedLocationNames?.length) {
      throw ApiError.badRequest('sessionKey and selectedLocationNames required');
    }

    const redis = getRedis();
    const data = await redis.get(sessionKey);
    if (!data) throw ApiError.badRequest('Session expired');

    const { discovered } = JSON.parse(data);
    await redis.del(sessionKey);

    const selected = discovered.filter(d => selectedLocationNames.includes(d.locationName));
    const connected = [];

    for (const loc of selected) {
      // page_id = locationName (unique GMB location identifier)
      const result = await SocialAccountModel.upsert({
        client_id:       clientId,
        platform:        'google_gmb',
        page_id:         loc.locationName,
        ig_business_id:  loc.refreshToken || null,  // store refresh token here temporarily
        account_name:    loc.locationTitle || loc.locationName,
        username:        loc.locationAddress || null,
        profile_pic_url: null,
        access_token:    loc.accessToken,
        token_expires_at: loc.accessExpiresAt,
      });
      connected.push({ platform: 'google_gmb', name: loc.locationTitle, id: result.insertId || result.id });
    }

    logger.info('Google GMB locations connected', { clientId, connected });
    res.json({ success: true, connected });
  } catch (err) { next(err); }
});

// ── Disconnect ──────────────────────────────────────────────────────────────
router.delete('/accounts/:accountId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await SocialAccountModel.disconnect(req.params.accountId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

function popupClose(data) {
  const payload = JSON.stringify({ type: 'GOOGLE_OAUTH', ...data });
  const safePayload = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!DOCTYPE html><html><body><script>
    try { localStorage.setItem('google_oauth_result', '${safePayload}'); } catch(e) {}
    try { new BroadcastChannel('google-oauth').postMessage(${payload}); } catch(e) {}
    try { window.opener && window.opener.postMessage(${payload}, '*'); } catch(e) {}
    window.close();
  </script></body></html>`;
}

export default router;
