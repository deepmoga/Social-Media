import { Router } from 'express';
import crypto from 'crypto';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { MetaService } from '../services/metaService.js';
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

    // state = random nonce, stored in Redis with clientId for 10 min
    const state = crypto.randomBytes(20).toString('hex');
    const redis = getRedis();
    await redis.setex(`meta:oauth:state:${state}`, 600, JSON.stringify({ clientId, userId: req.user.id }));

    const url = MetaService.getOAuthUrl(state);
    res.json({ success: true, url });
  } catch (err) { next(err); }
});

// ── Step 2: OAuth callback (this URL is opened in a popup) ─────────────────
router.get('/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.send(popupClose({ error: error_description || error }));
  }

  if (!code || !state) {
    return res.send(popupClose({ error: 'Missing code or state' }));
  }

  try {
    const redis = getRedis();
    const stateData = await redis.get(`meta:oauth:state:${state}`);
    if (!stateData) return res.send(popupClose({ error: 'OAuth state expired or invalid' }));

    const { clientId } = JSON.parse(stateData);
    await redis.del(`meta:oauth:state:${state}`);

    // Exchange code for short-lived token
    const shortToken = await MetaService.exchangeCode(code);
    // Exchange for long-lived token (60 days)
    const { token: longToken, expiresAt } = await MetaService.getLongLivedToken(shortToken.access_token);

    // Fetch all pages the user manages
    const pages = await MetaService.getPages(longToken);

    // For each page, get its own page token + check for linked IG account
    const discovered = [];
    for (const page of pages) {
      try {
        const pageToken = await MetaService.getPageToken(page.id, longToken);
        const igAccount = await MetaService.getIgAccount(page.id, pageToken);

        discovered.push({
          pageId: page.id,
          pageName: page.name,
          pagePicture: page.picture?.data?.url || null,
          pageToken,
          pageTokenExpiry: null, // page tokens from long-lived user tokens are non-expiring
          igAccount: igAccount ? {
            id: igAccount.id,
            name: igAccount.name,
            username: igAccount.username,
            profilePicUrl: igAccount.profile_picture_url,
          } : null,
        });
      } catch (err) {
        logger.warn(`Could not fetch details for page ${page.id}`, { error: err.message });
      }
    }

    // Store discovered pages temporarily in Redis (5 min) so user can select
    const sessionKey = `meta:discovered:${state}-result`;
    await redis.setex(sessionKey, 300, JSON.stringify({ clientId, discovered }));

    res.send(popupClose({ sessionKey, pageCount: discovered.length }));
  } catch (err) {
    logger.error('Meta OAuth callback error', { error: err.message });
    res.send(popupClose({ error: err.message }));
  }
});

// ── Step 3: Retrieve discovered pages ──────────────────────────────────────
router.get('/discovered', authenticate, requireAdmin, async (req, res, next) => {
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

// ── Step 4: Confirm selection and save accounts ─────────────────────────────
router.post('/connect', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { sessionKey, selectedPageIds, clientId } = req.body;
    if (!sessionKey || !selectedPageIds?.length) throw ApiError.badRequest('sessionKey and selectedPageIds required');

    const redis = getRedis();
    const data = await redis.get(sessionKey);
    if (!data) throw ApiError.badRequest('Session expired');

    const { discovered } = JSON.parse(data);
    await redis.del(sessionKey);

    const selected = discovered.filter(d => selectedPageIds.includes(d.pageId));
    const connected = [];

    for (const page of selected) {
      if (!page.pageToken) {
        throw ApiError.badRequest(`No access token for page "${page.pageName}". Please reconnect and grant all requested permissions.`);
      }

      // Save Facebook Page account
      const fbResult = await SocialAccountModel.upsert({
        client_id: clientId,
        platform: 'facebook',
        page_id: page.pageId,
        ig_business_id: page.igAccount?.id || null,
        account_name: page.pageName,
        username: null,
        profile_pic_url: page.pagePicture,
        access_token: page.pageToken,
        token_expires_at: page.pageTokenExpiry,
      });
      connected.push({ platform: 'facebook', name: page.pageName, id: fbResult.insertId || fbResult.id });

      // If page has linked IG account, save it separately
      if (page.igAccount) {
        const igAccName = page.igAccount.name || page.igAccount.username || page.pageName;
        const igResult = await SocialAccountModel.upsert({
          client_id: clientId,
          platform: 'instagram',
          page_id: page.igAccount.id,
          ig_business_id: page.igAccount.id,
          account_name: igAccName,
          username: page.igAccount.username,
          profile_pic_url: page.igAccount.profilePicUrl,
          access_token: page.pageToken,
          token_expires_at: page.pageTokenExpiry,
        });
        connected.push({ platform: 'instagram', name: page.igAccount.username || igAccName, id: igResult.insertId || igResult.id });
      }
    }

    logger.info('Accounts connected', { clientId, connected });
    res.json({ success: true, connected });
  } catch (err) { next(err); }
});

// ── Disconnect an account ───────────────────────────────────────────────────
router.delete('/accounts/:accountId', authenticate, requireAdmin, async (req, res, next) => {
  try {
    await SocialAccountModel.disconnect(req.params.accountId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── IG Rate limit for a client ─────────────────────────────────────────────
router.get('/rate-limit/:accountId', authenticate, async (req, res, next) => {
  try {
    const account = await SocialAccountModel.findById(req.params.accountId);
    if (!account || account.platform !== 'instagram') throw ApiError.notFound('Instagram account not found');
    const token = await SocialAccountModel.getToken(req.params.accountId);
    const limit = await MetaService.getIgPublishingLimit(account.ig_business_id || account.page_id, token);
    res.json({ success: true, limit });
  } catch (err) { next(err); }
});

function popupClose(data) {
  const payload = JSON.stringify({ type: 'META_OAUTH', ...data });
  // Use localStorage so parent can poll — avoids cross-origin opener issues
  const safePayload = payload.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!DOCTYPE html><html><body><script>
    try { localStorage.setItem('meta_oauth_result', '${safePayload}'); } catch(e) {}
    try { new BroadcastChannel('meta-oauth').postMessage(${payload}); } catch(e) {}
    try { window.opener && window.opener.postMessage(${payload}, '*'); } catch(e) {}
    window.close();
  </script></body></html>`;
}

// ── Token health check ────────────────────────────────────────────────────
router.get('/token-check/:accountId', authenticate, async (req, res, next) => {
  try {
    const account = await SocialAccountModel.findById(req.params.accountId);
    if (!account) throw ApiError.notFound('Account not found');
    const token = await SocialAccountModel.getToken(account.id);
    const result = await MetaService.validateToken(token);
    if (!result.valid) {
      await SocialAccountModel.updateStatus(account.id, 'token_expired');
    }
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

export default router;
