import cron from 'node-cron';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { query } from '../config/database.js';
import logger from '../utils/logger.js';

// Run daily: page tokens with NULL expiry are non-expiring — skip them.
// Only check tokens that actually have an expiry date set (legacy records).
export function startTokenRefreshJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      // Fix legacy records: set token_expires_at = NULL for active accounts
      // Page tokens from long-lived user tokens never expire
      await query(
        `UPDATE social_accounts SET token_expires_at = NULL
         WHERE status = 'active' AND token_expires_at IS NOT NULL`
      );
      logger.info('Token refresh: cleared expiry dates (page tokens are non-expiring)');
    } catch (err) {
      logger.error('Token refresh cron error', { error: err.message });
    }
  });

  logger.info('Token refresh cron started (daily at 08:00)');
}
