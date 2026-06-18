import cron from 'node-cron';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { MetaService } from '../services/metaService.js';
import logger from '../utils/logger.js';

// Run daily: check tokens expiring within 10 days and attempt refresh
export function startTokenRefreshJob() {
  cron.schedule('0 8 * * *', async () => {
    try {
      const expiring = await SocialAccountModel.findExpiringSoon(10);
      logger.info(`Token refresh check: ${expiring.length} expiring soon`);

      for (const account of expiring) {
        try {
          const currentToken = await SocialAccountModel.getToken(account.id);
          const { token, expiresAt } = await MetaService.getLongLivedToken(currentToken);
          await SocialAccountModel.updateToken(account.id, token, expiresAt);
          logger.info('Token refreshed', { accountId: account.id, accountName: account.account_name });
        } catch (err) {
          logger.error('Token refresh failed', {
            accountId: account.id,
            accountName: account.account_name,
            error: err.message,
          });
          // Mark as expired so dashboard can show a warning
          await SocialAccountModel.updateStatus(account.id, 'token_expired');
        }
      }
    } catch (err) {
      logger.error('Token refresh cron error', { error: err.message });
    }
  });

  logger.info('Token refresh cron started (daily at 08:00)');
}
