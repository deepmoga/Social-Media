import axios from 'axios';
import logger from '../utils/logger.js';

const TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
const API_BASE  = 'https://open.tiktokapis.com/v2';

function ttError(err) {
  const d = err.response?.data?.error;
  if (!d) return err.message;
  return `TikTok error ${d.code}: ${d.message}`;
}

export const TikTokService = {

  // ── OAuth ───────────────────────────────────────────────────────────────────

  getOAuthUrl(state) {
    const scopes = ['user.info.basic', 'video.upload', 'video.publish'].join(',');
    const params = new URLSearchParams({
      client_key:    process.env.TIKTOK_CLIENT_KEY,
      scope:         scopes,
      response_type: 'code',
      redirect_uri:  process.env.TIKTOK_REDIRECT_URI,
      state,
    });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },

  async exchangeCode(code) {
    try {
      const res = await axios.post(TOKEN_URL, new URLSearchParams({
        client_key:    process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type:    'authorization_code',
        redirect_uri:  process.env.TIKTOK_REDIRECT_URI,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return res.data; // { access_token, refresh_token, open_id, scope, expires_in, refresh_expires_in }
    } catch (err) {
      throw new Error(ttError(err));
    }
  },

  async refreshAccessToken(refreshToken) {
    try {
      const res = await axios.post(TOKEN_URL, new URLSearchParams({
        client_key:    process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return res.data; // { access_token, refresh_token, expires_in, refresh_expires_in }
    } catch (err) {
      throw new Error(ttError(err));
    }
  },

  async getUserInfo(accessToken, openId) {
    try {
      const res = await axios.get(`${API_BASE}/user/info/`, {
        params: { fields: 'open_id,display_name,avatar_url' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data?.data?.user || {};
    } catch (err) {
      throw new Error(ttError(err));
    }
  },

  // ── Publishing ──────────────────────────────────────────────────────────────
  // TikTok Content Posting API — PULL_FROM_URL mode (video must be public URL)

  async initVideoUpload(accessToken, { openId, videoUrl, caption, disableDuet = false, disableStitch = false }) {
    try {
      const res = await axios.post(`${API_BASE}/post/publish/video/init/`, {
        post_info: {
          title:           caption?.slice(0, 2200) || '',
          privacy_level:   'PUBLIC_TO_EVERYONE',
          disable_duet:    disableDuet,
          disable_stitch:  disableStitch,
          disable_comment: false,
        },
        source_info: {
          source:    'PULL_FROM_URL',
          video_url: videoUrl,
        },
      }, {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      });
      return res.data?.data; // { publish_id }
    } catch (err) {
      throw new Error(ttError(err));
    }
  },

  async pollPublishStatus(accessToken, publishId, maxAttempts = 30, intervalMs = 5000) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const res = await axios.post(`${API_BASE}/post/publish/status/fetch/`, {
          publish_id: publishId,
        }, {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
        });
        const status = res.data?.data?.status;
        if (status === 'PUBLISH_COMPLETE') return res.data.data;
        if (status === 'FAILED') throw new Error(`TikTok publish failed: ${res.data?.data?.fail_reason || 'unknown'}`);
        await new Promise(r => setTimeout(r, intervalMs));
      } catch (err) {
        if (err.message.includes('TikTok publish failed')) throw err;
        throw new Error(ttError(err));
      }
    }
    throw new Error('TikTok publish status polling timed out');
  },

  async validateToken(accessToken) {
    try {
      const res = await axios.get(`${API_BASE}/user/info/`, {
        params: { fields: 'open_id,display_name' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const user = res.data?.data?.user;
      return { valid: true, displayName: user?.display_name };
    } catch {
      return { valid: false };
    }
  },
};
