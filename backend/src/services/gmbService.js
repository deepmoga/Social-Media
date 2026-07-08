import axios from 'axios';
import logger from '../utils/logger.js';

const TOKEN_URL   = 'https://oauth2.googleapis.com/token';
const ACCOUNTS_URL = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
const LOCATIONS_URL = (accountName) => `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`;
const POSTS_URL     = (locationName) => `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`;

function gmbError(err) {
  const d = err.response?.data?.error;
  if (!d) return err.message;
  return `Google error ${d.code}: ${d.message}`;
}

export const GmbService = {

  // ── OAuth ───────────────────────────────────────────────────────────────────

  getOAuthUrl(state) {
    const scopes = [
      'https://www.googleapis.com/auth/business.manage',
    ].join(' ');
    const params = new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID,
      redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope:         scopes,
      access_type:   'offline',
      prompt:        'consent',   // force refresh_token every time
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },

  async exchangeCode(code) {
    try {
      const res = await axios.post(TOKEN_URL, new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
        grant_type:    'authorization_code',
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return res.data; // { access_token, refresh_token, expires_in, token_type }
    } catch (err) {
      throw new Error(gmbError(err));
    }
  },

  async refreshAccessToken(refreshToken) {
    try {
      const res = await axios.post(TOKEN_URL, new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type:    'refresh_token',
      }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      return res.data; // { access_token, expires_in }
    } catch (err) {
      throw new Error(gmbError(err));
    }
  },

  async getAccounts(accessToken) {
    try {
      const res = await axios.get(ACCOUNTS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data?.accounts || [];
    } catch (err) {
      throw new Error(gmbError(err));
    }
  },

  async getLocations(accessToken, accountName) {
    try {
      const res = await axios.get(LOCATIONS_URL(accountName), {
        params: { readMask: 'name,title,storefrontAddress,websiteUri,profile' },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.data?.locations || [];
    } catch (err) {
      throw new Error(gmbError(err));
    }
  },

  // ── Publishing ──────────────────────────────────────────────────────────────

  async createPost(accessToken, locationName, { summary, imageUrl }) {
    try {
      const body = {
        languageCode: 'en',
        summary:      summary?.slice(0, 1500) || '',
        topicType:    'STANDARD',
      };

      if (imageUrl) {
        body.media = [{
          mediaFormat: 'PHOTO',
          sourceUrl:   imageUrl,
        }];
      }

      const res = await axios.post(POSTS_URL(locationName), body, {
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return res.data; // { name, languageCode, summary, state, ... }
    } catch (err) {
      throw new Error(gmbError(err));
    }
  },

  async validateToken(accessToken) {
    try {
      await axios.get(ACCOUNTS_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return { valid: true };
    } catch {
      return { valid: false };
    }
  },
};
