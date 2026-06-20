import axios from 'axios';
import { ApiError } from '../utils/apiError.js';
import logger from '../utils/logger.js';

const API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`;

function metaErrorMessage(err) {
  const d = err.response?.data?.error;
  if (!d) return err.message;
  return `Meta API error ${d.code}: ${d.message}${d.error_subcode ? ` (subcode ${d.error_subcode})` : ''}`;
}

async function get(path, params = {}) {
  try {
    const res = await axios.get(`${API_BASE}${path}`, { params });
    return res.data;
  } catch (err) {
    throw new Error(metaErrorMessage(err));
  }
}

async function post(path, data = {}, params = {}) {
  try {
    const res = await axios.post(`${API_BASE}${path}`, data, { params });
    return res.data;
  } catch (err) {
    throw new Error(metaErrorMessage(err));
  }
}

export const MetaService = {
  // ── OAuth ───────────────────────────────────────────────────────────────────

  getOAuthUrl(state) {
    const scopes = [
      'pages_show_list',
      'pages_manage_metadata',
      'pages_manage_posts',
      'pages_read_engagement',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_insights',
      'read_insights',
    ].join(',');

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID,
      redirect_uri: process.env.META_REDIRECT_URI,
      scope: scopes,
      response_type: 'code',
      state,
    });

    return `https://www.facebook.com/${process.env.META_API_VERSION || 'v21.0'}/dialog/oauth?${params}`;
  },

  async exchangeCode(code) {
    const res = await get('/oauth/access_token', {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    });
    return res; // { access_token, token_type }
  },

  async getLongLivedToken(shortToken) {
    const res = await get('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortToken,
    });
    // expires_in is in seconds
    const expiresAt = new Date(Date.now() + (res.expires_in || 5184000) * 1000);
    return { token: res.access_token, expiresAt };
  },

  // Exchange user long-lived token for a never-expiring page token
  async getPageToken(pageId, userToken) {
    const res = await get(`/${pageId}`, {
      fields: 'access_token',
      access_token: userToken,
    });
    return res.access_token;
  },

  async getPages(userToken) {
    const res = await get('/me/accounts', {
      access_token: userToken,
      fields: 'id,name,picture,access_token,instagram_business_account',
    });
    return res.data || [];
  },

  async getIgAccount(pageId, pageToken) {
    const res = await get(`/${pageId}`, {
      fields: 'instagram_business_account{id,name,username,profile_picture_url}',
      access_token: pageToken,
    });
    return res.instagram_business_account || null;
  },

  // ── Publishing: Facebook ────────────────────────────────────────────────────

  async publishFbPhoto(pageId, token, { imageUrl, caption }) {
    return post(`/${pageId}/photos`, null, {
      url: imageUrl,
      caption,
      access_token: token,
      published: true,
    });
  },

  async publishFbVideo(pageId, token, { videoUrl, caption }) {
    return post(`/${pageId}/videos`, null, {
      file_url: videoUrl,
      description: caption,
      access_token: token,
    });
  },

  async publishFbCarousel(pageId, token, { mediaUrls, caption }) {
    // FB doesn't natively support carousel in the same way IG does;
    // publish as a photo album
    const albumRes = await post(`/${pageId}/albums`, null, {
      name: caption?.slice(0, 100) || 'Album',
      access_token: token,
    });
    const albumId = albumRes.id;
    for (const url of mediaUrls) {
      await post(`/${albumId}/photos`, null, { url, access_token: token });
    }
    return albumRes;
  },

  // ── Publishing: Instagram ───────────────────────────────────────────────────

  async createIgImageContainer(igAccountId, token, { imageUrl, caption, isStory = false }) {
    return post(`/${igAccountId}/media`, null, {
      image_url: imageUrl,
      caption: isStory ? undefined : caption,
      media_type: isStory ? 'STORIES' : undefined,
      access_token: token,
    });
  },

  async createIgVideoContainer(igAccountId, token, { videoUrl, caption, isReel = false, isStory = false }) {
    let media_type = 'VIDEO';
    if (isReel) media_type = 'REELS';
    if (isStory) media_type = 'STORIES';
    return post(`/${igAccountId}/media`, null, {
      video_url: videoUrl,
      caption: isStory ? undefined : caption,
      media_type,
      access_token: token,
    });
  },

  async pollContainerStatus(containerId, token, maxAttempts = 20, intervalMs = 5000) {
    for (let i = 0; i < maxAttempts; i++) {
      const res = await get(`/${containerId}`, {
        fields: 'status_code,status',
        access_token: token,
      });
      if (res.status_code === 'FINISHED') return res;
      if (res.status_code === 'ERROR') throw new Error(`IG container error: ${res.status}`);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    throw new Error('IG container status polling timed out');
  },

  async publishIgContainer(igAccountId, token, containerId) {
    return post(`/${igAccountId}/media_publish`, null, {
      creation_id: containerId,
      access_token: token,
    });
  },

  async createIgCarouselItem(igAccountId, token, { mediaUrl, mediaType }) {
    const field = mediaType === 'video' ? 'video_url' : 'image_url';
    return post(`/${igAccountId}/media`, null, {
      [field]: mediaUrl,
      is_carousel_item: true,
      access_token: token,
    });
  },

  async createIgCarouselContainer(igAccountId, token, { childIds, caption }) {
    return post(`/${igAccountId}/media`, null, {
      media_type: 'CAROUSEL',
      children: childIds.join(','),
      caption,
      access_token: token,
    });
  },

  // ── Rate limit check (IG: 25 posts / account / 24h) ────────────────────────

  async getIgPublishingLimit(igAccountId, token) {
    const res = await get(`/${igAccountId}/content_publishing_limit`, {
      fields: 'config,quota_usage',
      access_token: token,
    });
    return res.data?.[0] || null;
  },
};
