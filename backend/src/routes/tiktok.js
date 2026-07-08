import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { TikTokService } from '../services/tiktokService.js';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { getRedis } from '../config/redis.js';
import { encrypt } from '../utils/encryption.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();

// ── Step 1: Generate OAuth URL ──────────────────────────────────────────────
router.get('/oauth-url', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { clientId } = req.query;
    if (!clientId) throw ApiError.badRequest('clientId required');
    if (!process.env.TIKTOK_CLIENT_KEY) throw ApiError.badRequest('TIKTOK_CLIENT_KEY not configured in Settings');

    const state = crypto.randomBytes(20).toString('hex');
    const redis = getRedis();
    await redis.setex(`tiktok:oauth:state:${state}`, 600, JSON.stringify({ clientId, userId: req.user.id }));

    const url = TikTokService.getOAuthUrl(state);
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
    const stateData = await redis.get(`tiktok:oauth:state:${state}`);
    if (!stateData) return res.send(popupClose({ error: 'OAuth state expired. Please try again.' }));

    const { clientId } = JSON.parse(stateData);
    await redis.del(`tiktok:oauth:state:${state}`);

    // Exchange code for tokens
    const tokens = await TikTokService.exchangeCode(code);
    const { access_token, refresh_token, open_id, expires_in, refresh_expires_in } = tokens;

    if (!access_token || !open_id) {
      return res.send(popupClose({ error: 'TikTok did not return an access token' }));
    }

    // Get user info (display name, avatar)
    const userInfo = await TikTokService.getUserInfo(access_token, open_id);

    // Token expiry times
    const accessExpiresAt  = new Date(Date.now() + (expires_in || 86400) * 1000);
    const refreshExpiresAt = new Date(Date.now() + (refresh_expires_in || 31536000) * 1000);

    // Upsert social account (client_id + platform + page_id=open_id)
    await SocialAccountModel.upsert({
      client_id:       clientId,
      platform:        'tiktok',
      page_id:         open_id,
      ig_business_id:  null,
      account_name:    userInfo.display_name || `TikTok (${open_id})`,
      username:        userInfo.display_name || open_id,
      profile_pic_url: userInfo.avatar_url || null,
      access_token:    access_token,
      token_expires_at: accessExpiresAt,
    });

    // Save refresh token separately in a dedicated table row via extra column
    // We store refresh token encrypted in a second upsert using ig_business_id field as carrier
    // Better: store it in a separate settings key per account
    // For now: store refresh_token encrypted in ig_business_id col (repurposed temporarily)
    // We'll use a dedicated query to save it properly
    await query(
      `UPDATE social_accounts SET 
        ig_business_id = ?,
        token_expires_at = ?
       WHERE client_id = ? AND platform = 'tiktok' AND page_id = ?`,
      [encrypt(refresh_token || ''), accessExpiresAt, clientId, open_id]
    );

    logger.info(`TikTok account connected: ${userInfo.display_name} for client ${clientId}`);
    res.send(popupClose({ success: true, accountName: userInfo.display_name || open_id }));
  } catch (err) {
    logger.error('TikTok OAuth callback error', { error: err.message });
    res.send(popupClose({ error: err.message }));
  }
});

// ── Disconnect ──────────────────────────────────────────────────────────────
router.delete('/accounts/:accountId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await SocialAccountModel.disconnect(req.params.accountId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

function popupClose(data) {
  const payload = JSON.stringify({ type: 'TIKTOK_OAUTH', ...data });
  const safePayload = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!DOCTYPE html><html><body><script>
    try { localStorage.setItem('tiktok_oauth_result', '${safePayload}'); } catch(e) {}
    try { new BroadcastChannel('tiktok-oauth').postMessage(${payload}); } catch(e) {}
    try { window.opener && window.opener.postMessage(${payload}, '*'); } catch(e) {}
    window.close();
  </script></body></html>`;
}

export default router;
