import { Router } from 'express';
import axios from 'axios';
import { authenticate } from '../middleware/auth.js';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use(authenticate);

const GRAPH = 'https://graph.facebook.com/v21.0';

async function fbGet(path, params) {
  const res = await axios.get(`${GRAPH}${path}`, { params });
  return res.data;
}

// GET /api/insights/:clientId?platform=facebook|instagram
router.get('/:clientId', async (req, res, next) => {
  try {
    const { clientId } = req.params;
    const { platform } = req.query;

    const accounts = await SocialAccountModel.findByClient(clientId);
    const filtered = platform ? accounts.filter(a => a.platform === platform) : accounts;

    const results = [];

    for (const account of filtered) {
      const token = await SocialAccountModel.getToken(account.id);

      try {
        if (account.platform === 'facebook') {
          const data = await fbGet(`/${account.page_id}/posts`, {
            fields: 'id,message,created_time,full_picture,likes.summary(true),comments.summary(true),shares,insights.metric(post_impressions_unique,post_impressions,post_engaged_users)',
            limit: 20,
            access_token: token,
          });

          const posts = (data.data || []).map(p => ({
            id: p.id,
            caption: p.message || '',
            thumbnail: p.full_picture || null,
            created_time: p.created_time,
            platform: 'facebook',
            account_name: account.account_name,
            account_id: account.id,
            likes: p.likes?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
            shares: p.shares?.count || 0,
            reach: p.insights?.data?.find(i => i.name === 'post_impressions_unique')?.values?.[0]?.value || 0,
            impressions: p.insights?.data?.find(i => i.name === 'post_impressions')?.values?.[0]?.value || 0,
            engaged: p.insights?.data?.find(i => i.name === 'post_engaged_users')?.values?.[0]?.value || 0,
          }));

          results.push({ account_id: account.id, account_name: account.account_name, platform: 'facebook', posts });

        } else if (account.platform === 'instagram') {
          const igId = account.ig_business_id || account.page_id;
          const data = await fbGet(`/${igId}/media`, {
            fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
            limit: 20,
            access_token: token,
          });

          const mediaPosts = data.data || [];

          // Fetch insights for each media (reach, impressions, saved)
          const posts = await Promise.all(mediaPosts.map(async m => {
            let reach = 0, impressions = 0, saved = 0, views = 0;
            try {
              const metric = m.media_type === 'VIDEO' ? 'reach,impressions,saved,video_views' : 'reach,impressions,saved';
              const ins = await fbGet(`/${m.id}/insights`, { metric, access_token: token });
              for (const d of ins.data || []) {
                if (d.name === 'reach') reach = d.values?.[0]?.value || 0;
                if (d.name === 'impressions') impressions = d.values?.[0]?.value || 0;
                if (d.name === 'saved') saved = d.values?.[0]?.value || 0;
                if (d.name === 'video_views') views = d.values?.[0]?.value || 0;
              }
            } catch (_) {}
            return {
              id: m.id,
              caption: m.caption || '',
              thumbnail: m.thumbnail_url || m.media_url || null,
              created_time: m.timestamp,
              platform: 'instagram',
              account_name: account.account_name,
              account_id: account.id,
              media_type: m.media_type,
              likes: m.like_count || 0,
              comments: m.comments_count || 0,
              shares: 0,
              reach,
              impressions,
              saved,
              views,
            };
          }));

          results.push({ account_id: account.id, account_name: account.account_name, platform: 'instagram', posts });
        }
      } catch (err) {
        results.push({ account_id: account.id, account_name: account.account_name, platform: account.platform, posts: [], error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) { next(err); }
});

export default router;
