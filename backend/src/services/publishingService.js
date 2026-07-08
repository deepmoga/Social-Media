import { PostModel } from '../models/Post.js';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { MetaService } from './metaService.js';
import { TikTokService } from './tiktokService.js';
import { GmbService } from './gmbService.js';
import { decrypt } from '../utils/encryption.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

const MAX_RETRIES = 3;

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Token resolution ──────────────────────────────────────────────────────────
// Priority: 1) Permanent token from Settings (META_PERMANENT_TOKEN)
//           2) Per-account stored token (OAuth flow)
// This lets admins paste a never-expiring page token once in Settings and
// never worry about reconnecting accounts again.
async function resolveToken(accountId) {
  const permanentToken = process.env.META_PERMANENT_TOKEN;
  if (permanentToken && permanentToken.trim().length > 20) {
    return permanentToken.trim();
  }
  return SocialAccountModel.getToken(accountId);
}

// ── Error classification ──────────────────────────────────────────────────────
// Meta error 190 can mean token expired OR missing permissions.
// Distinguish so we show the right message.
function classifyMetaError(errMsg) {
  if (!errMsg) return 'unknown';
  if (errMsg.includes('permission') || errMsg.includes('impersonating')) {
    return 'permissions';
  }
  if (errMsg.includes('190') || errMsg.includes('expired') || errMsg.includes('invalid')) {
    return 'token_expired';
  }
  return 'other';
}

async function logAttempt(postPlatformId, attempt, status, response, errorMessage, durationMs) {
  await query(
    'INSERT INTO publish_logs (post_platform_id, attempt_number, status, response_body, error_message, duration_ms) VALUES (?, ?, ?, ?, ?, ?)',
    [postPlatformId, attempt, status, response ? JSON.stringify(response) : null, errorMessage, durationMs]
  );
}

async function publishToFacebook(account, token, post, media) {
  const pageId = account.page_id;
  if (post.content_type === 'image') {
    return MetaService.publishFbPhoto(pageId, token, {
      imageUrl: media[0].media_url, caption: post.caption,
    });
  }
  if (post.content_type === 'video') {
    return MetaService.publishFbVideo(pageId, token, {
      videoUrl: media[0].media_url, caption: post.caption,
    });
  }
  if (post.content_type === 'carousel') {
    return MetaService.publishFbCarousel(pageId, token, {
      mediaUrls: media.map(m => m.media_url), caption: post.caption,
    });
  }
  if (post.content_type === 'story') {
    // FB stories via API — publish as photo to feed (limited API support)
    return MetaService.publishFbPhoto(pageId, token, {
      imageUrl: media[0].media_url, caption: '',
    });
  }
  throw new Error(`Unsupported content type: ${post.content_type}`);
}

async function publishToInstagram(account, token, post, media) {
  // Find the IG business account ID
  const igId = account.ig_business_id || account.page_id;
  if (!igId) throw new Error('No Instagram business account ID on this record');

  const isStory = post.content_type === 'story';

  if (post.content_type === 'image' || (isStory && media[0]?.media_type === 'image')) {
    const container = await MetaService.createIgImageContainer(igId, token, {
      imageUrl: media[0].media_url, caption: post.caption, isStory,
    });
    return MetaService.publishIgContainer(igId, token, container.id);
  }

  if (post.content_type === 'video' || (isStory && media[0]?.media_type === 'video')) {
    const isReel = post.content_type === 'video' && !isStory;
    const container = await MetaService.createIgVideoContainer(igId, token, {
      videoUrl: media[0].media_url, caption: post.caption, isReel, isStory,
      coverUrl: media[0].cover_url || undefined,
    });
    // Poll until processing is done
    await MetaService.pollContainerStatus(container.id, token);
    return MetaService.publishIgContainer(igId, token, container.id);
  }

  if (post.content_type === 'carousel') {
    const childIds = [];
    for (const m of media) {
      const child = await MetaService.createIgCarouselItem(igId, token, {
        mediaUrl: m.media_url, mediaType: m.media_type,
      });
      if (m.media_type === 'video') await MetaService.pollContainerStatus(child.id, token);
      childIds.push(child.id);
    }
    const carousel = await MetaService.createIgCarouselContainer(igId, token, {
      childIds, caption: post.caption,
    });
    return MetaService.publishIgContainer(igId, token, carousel.id);
  }

  throw new Error(`Unsupported content type for Instagram: ${post.content_type}`);
}

async function publishToTikTok(account, token, post, media) {
  // TikTok only supports video
  const videoMedia = media.find(m => m.media_type === 'video');
  if (!videoMedia) throw new Error('TikTok only supports video content. Please select a video post.');

  const result = await TikTokService.initVideoUpload(token, {
    openId:    account.page_id,
    videoUrl:  videoMedia.media_url,
    caption:   post.caption,
  });

  if (!result?.publish_id) throw new Error('TikTok did not return a publish_id');

  // Poll until published
  const status = await TikTokService.pollPublishStatus(token, result.publish_id);
  return { id: result.publish_id, ...status };
}

async function publishToGmb(account, token, post, media) {
  // GMB supports text + optional image
  const imageMedia = media.find(m => m.media_type === 'image');
  const locationName = account.page_id; // stored as GMB locationName

  const result = await GmbService.createPost(token, locationName, {
    summary:  post.caption,
    imageUrl: imageMedia?.media_url || null,
  });

  return { id: result.name, ...result };
}

export const PublishingService = {
  async publishPost(postId) {
    const post = await PostModel.findById(postId);
    if (!post) throw new Error(`Post ${postId} not found`);

    const media = await PostModel.getMedia(postId);
    const platforms = await PostModel.getPlatforms(postId);

    if (!platforms.length) {
      logger.warn(`Post ${postId} has no platforms assigned`);
      return;
    }

    const usingPermanentToken = !!(process.env.META_PERMANENT_TOKEN?.trim().length > 20);
    if (usingPermanentToken) {
      logger.info(`Post ${postId}: using META_PERMANENT_TOKEN for publishing`);
    }

    await PostModel.update(postId, { status: 'publishing' });
    let allOk = true;
    let anyOk = false;

    for (const pp of platforms) {
      const start = Date.now();
      let attempt = (pp.attempt_count || 0) + 1;

      try {
        const account = await SocialAccountModel.findById(pp.social_account_id);
        const token = await resolveToken(pp.social_account_id);

        // Only validate token if NOT using the global permanent token
        // (permanent token is assumed valid by admin — skip the extra API call)
        if (!usingPermanentToken) {
          const tokenCheck = await MetaService.validateToken(token);
          if (!tokenCheck.valid) {
            const errType = classifyMetaError(tokenCheck.error);
            if (errType === 'permissions') {
              // Permissions issue — don't mark as token_expired, just log
              throw new Error(
                `Permission error for "${account.account_name}": The Facebook app lacks required page permissions. ` +
                `Please check your Meta App settings or use a Permanent Token in Settings. (${tokenCheck.error})`
              );
            }
            await SocialAccountModel.updateStatus(pp.social_account_id, 'token_expired');
            throw new Error(`Token expired for ${account.account_name}. Please reconnect the account or set a Permanent Token in Settings. (${tokenCheck.error})`);
          }
        }

        let result;
        if (account.platform === 'facebook') {
          result = await publishToFacebook(account, token, post, media);
        } else if (account.platform === 'instagram') {
          result = await publishToInstagram(account, token, post, media);
        } else if (account.platform === 'tiktok') {
          result = await publishToTikTok(account, token, post, media);
        } else if (account.platform === 'google_gmb') {
          // Google tokens expire in 1h — refresh if needed
          const now = Date.now();
          const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
          let activeToken = token;
          if (expiresAt && expiresAt - now < 5 * 60 * 1000) {
            try {
              const refreshToken = account.ig_business_id ? decrypt(account.ig_business_id) : null;
              if (refreshToken) {
                const refreshed = await GmbService.refreshAccessToken(refreshToken);
                activeToken = refreshed.access_token;
                const newExpiry = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000);
                await SocialAccountModel.updateToken(pp.social_account_id, activeToken, newExpiry);
              }
            } catch (e) {
              logger.warn(`Could not refresh Google token for account ${pp.social_account_id}`, { error: e.message });
            }
          }
          result = await publishToGmb(account, activeToken, post, media);
        } else {
          throw new Error(`Unknown platform: ${account.platform}`);
        }

        // Mark account active on successful publish
        await SocialAccountModel.updateStatus(pp.social_account_id, 'active');

        await PostModel.updatePlatformStatus(pp.id, {
          publish_status: 'published',
          platform_post_id: result.id || result.post_id,
          error_log: null,
          published_at: new Date(),
        });
        await logAttempt(pp.id, attempt, 'success', result, null, Date.now() - start);
        anyOk = true;
        logger.info(`Published post ${postId} to ${account.platform}:${account.account_name}`);
      } catch (err) {
        allOk = false;
        const errMsg = err.message;
        const shouldRetry = attempt < MAX_RETRIES;
        const nextRetry = shouldRetry
          ? new Date(Date.now() + Math.pow(2, attempt) * 60 * 1000)
          : null;

        await PostModel.updatePlatformStatus(pp.id, {
          publish_status: 'failed',
          platform_post_id: null,
          error_log: errMsg,
          published_at: null,
        });
        if (nextRetry) {
          await query('UPDATE post_platforms SET next_retry_at = ? WHERE id = ?', [nextRetry, pp.id]);
        }
        await logAttempt(pp.id, attempt, 'failed', null, errMsg, Date.now() - start);
        logger.error(`Failed to publish post ${postId} platform ${pp.id}`, { error: errMsg, attempt });
      }
    }

    const finalStatus = allOk ? 'published' : anyOk ? 'partially_failed' : 'failed';
    await PostModel.update(postId, { status: finalStatus });
    return finalStatus;
  },

  async retryPlatform(postPlatformId) {
    const pp = await query('SELECT * FROM post_platforms WHERE id = ?', [postPlatformId]);
    if (!pp[0]) throw new Error('Post platform record not found');
    return this.publishPost(pp[0].post_id);
  },
};
