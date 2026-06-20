import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { query, queryOne } from '../config/database.js';
import { decrypt } from '../utils/encryption.js';
import { ApiError } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const router = Router();
const GRAPH = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;

// ── Graph API helpers ────────────────────────────────────────────────────────

async function sendMsg(recipientId, messageObj, token) {
  try {
    await axios.post(`${GRAPH}/me/messages`, {
      recipient: { id: recipientId },
      message: messageObj,
    }, { params: { access_token: token } });
  } catch (err) {
    logger.error('sendMsg failed', { error: err.response?.data || err.message });
  }
}

async function sendPrivateReply(commentId, messageObj, token) {
  try {
    await axios.post(`${GRAPH}/me/messages`, {
      recipient: { comment_id: commentId },
      message: messageObj,
    }, { params: { access_token: token } });
  } catch (err) {
    logger.error('sendPrivateReply failed', { error: err.response?.data || err.message });
  }
}

// ── Webhook (public, no auth) ────────────────────────────────────────────────

router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN || 'odm-webhook-2026';
  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('Meta webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

router.post('/webhook', (req, res) => {
  res.sendStatus(200);
  processWebhook(req.body).catch(err => logger.error('Webhook processing error', { error: err.message }));
});

async function processWebhook(body) {
  if (body.object !== 'instagram' && body.object !== 'page') return;
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field === 'comments') await handleComment(change.value);
    }
    for (const msg of entry.messaging || []) {
      if (msg.postback) await handlePostback(msg);
      else if (msg.message && !msg.message.is_echo) await handleDM(msg);
    }
  }
}

async function handleComment(value) {
  if (!value?.text || !value?.media?.id || !value?.from?.id) return;
  const mediaId = value.media.id;
  const text = value.text.toLowerCase().trim();
  const commentId = value.id;
  const commenterId = value.from.id;

  const triggers = await query(
    `SELECT rt.*, sa.access_token_encrypted FROM reel_triggers rt
     JOIN social_accounts sa ON sa.id = rt.social_account_id
     WHERE rt.media_id = ? AND rt.trigger_type = 'comment' AND rt.is_active = 1`,
    [mediaId]
  );

  for (const t of triggers) {
    if (!t.match_any && (!t.keyword || !text.includes(t.keyword.toLowerCase()))) continue;
    const token = decrypt(t.access_token_encrypted);
    const confirmText = t.confirm_text || 'Hey! Thanks for your interest 😊 Click below and I\'ll send you the details!';
    const buttonLabel = t.confirm_button || 'Send me the link! ✨';
    const payload = `CONFIRM|${mediaId}|${t.keyword || 'ANY'}`;
    await sendPrivateReply(commentId, {
      text: confirmText,
      quick_replies: [{ content_type: 'text', title: buttonLabel.slice(0, 20), payload }],
    }, token);
    logger.info('Comment auto-reply sent', { mediaId, keyword: t.keyword, commenterId });
    break;
  }
}

async function handlePostback(msg) {
  const payload = msg.postback?.payload || '';
  const senderId = msg.sender?.id;
  if (!payload.startsWith('CONFIRM|') || !senderId) return;

  const [, mediaId, keyword] = payload.split('|');
  const trigger = await queryOne(
    `SELECT rt.*, sa.access_token_encrypted FROM reel_triggers rt
     JOIN social_accounts sa ON sa.id = rt.social_account_id
     WHERE rt.media_id = ? AND (rt.keyword = ? OR rt.match_any = 1) AND rt.is_active = 1`,
    [mediaId, keyword]
  );
  if (!trigger) return;

  const token = decrypt(trigger.access_token_encrypted);
  const finalMsg = trigger.link_text + (trigger.link_url ? `\n\n${trigger.link_url}` : '');
  await sendMsg(senderId, { text: finalMsg }, token);
  logger.info('Final link sent via DM postback', { mediaId, keyword, senderId });
}

async function handleDM(msg) {
  const senderId = msg.sender?.id;
  const text = msg.message?.text?.toLowerCase().trim();
  if (!senderId || !text) return;

  const triggers = await query(
    `SELECT rt.*, sa.access_token_encrypted FROM reel_triggers rt
     JOIN social_accounts sa ON sa.id = rt.social_account_id
     WHERE rt.trigger_type = 'dm' AND rt.is_active = 1`
  );

  for (const t of triggers) {
    if (!t.match_any && (!t.keyword || !text.includes(t.keyword.toLowerCase()))) continue;
    if (t.ignore_own && msg.sender?.id === msg.recipient?.id) continue;
    const token = decrypt(t.access_token_encrypted);
    const finalMsg = t.link_text + (t.link_url ? `\n\n${t.link_url}` : '');
    await sendMsg(senderId, { text: finalMsg }, token);
    logger.info('DM auto-reply sent', { keyword: t.keyword, senderId });
    break;
  }
}

// ── CRUD (authenticated) ─────────────────────────────────────────────────────

router.get('/triggers', authenticate, async (req, res, next) => {
  try {
    const { clientId } = req.query;
    if (!clientId) throw ApiError.badRequest('clientId required');
    const triggers = await query(
      `SELECT rt.*, sa.account_name, sa.platform, sa.profile_pic_url, sa.username FROM reel_triggers rt
       JOIN social_accounts sa ON sa.id = rt.social_account_id
       WHERE rt.client_id = ? ORDER BY rt.created_at DESC`,
      [clientId]
    );
    res.json({ success: true, triggers });
  } catch (err) { next(err); }
});

router.post('/triggers', authenticate, async (req, res, next) => {
  try {
    const {
      clientId, social_account_id, media_id, media_url, media_thumbnail,
      keyword, trigger_type, match_any, reply_every, ignore_own,
      confirm_text, confirm_button, link_text, link_url,
    } = req.body;
    if (!clientId || !social_account_id || !link_text) {
      throw ApiError.badRequest('clientId, social_account_id, link_text required');
    }
    if ((trigger_type || 'comment') === 'comment' && !media_id) {
      throw ApiError.badRequest('media_id required for comment triggers');
    }
    const result = await query(
      `INSERT INTO reel_triggers
       (client_id, social_account_id, media_id, media_url, media_thumbnail,
        keyword, trigger_type, match_any, reply_every, ignore_own,
        confirm_text, confirm_button, link_text, link_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        clientId, social_account_id, media_id || null, media_url || null, media_thumbnail || null,
        keyword || null, trigger_type || 'comment', match_any ? 1 : 0, reply_every ? 1 : 0, ignore_own ? 1 : 0,
        confirm_text || null, confirm_button || null, link_text, link_url || null,
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

router.put('/triggers/:id', authenticate, async (req, res, next) => {
  try {
    const { keyword, match_any, reply_every, ignore_own, confirm_text, confirm_button, link_text, link_url, is_active } = req.body;
    await query(
      `UPDATE reel_triggers SET keyword=?, match_any=?, reply_every=?, ignore_own=?,
       confirm_text=?, confirm_button=?, link_text=?, link_url=?, is_active=? WHERE id=?`,
      [keyword || null, match_any ? 1 : 0, reply_every ? 1 : 0, ignore_own ? 1 : 0,
       confirm_text || null, confirm_button || null, link_text, link_url || null,
       is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/triggers/:id', authenticate, async (req, res, next) => {
  try {
    await query('DELETE FROM reel_triggers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.patch('/triggers/:id/toggle', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE reel_triggers SET is_active = NOT is_active WHERE id = ?', [req.params.id]);
    const t = await queryOne('SELECT is_active FROM reel_triggers WHERE id = ?', [req.params.id]);
    res.json({ success: true, is_active: !!t.is_active });
  } catch (err) { next(err); }
});

router.get('/reels', authenticate, async (req, res, next) => {
  try {
    const { accountId } = req.query;
    if (!accountId) throw ApiError.badRequest('accountId required');
    const account = await queryOne('SELECT * FROM social_accounts WHERE id = ?', [accountId]);
    if (!account) throw ApiError.notFound('Account not found');
    const token = decrypt(account.access_token_encrypted);
    const igUserId = account.ig_business_id;
    const response = await axios.get(`${GRAPH}/${igUserId}/media`, {
      params: {
        fields: 'id,permalink,caption,thumbnail_url,media_url,media_type,timestamp',
        limit: 24,
        access_token: token,
      },
    });
    res.json({ success: true, reels: response.data.data || [] });
  } catch (err) { next(err); }
});

export default router;
