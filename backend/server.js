import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { testConnection, query } from './src/config/database.js';
import { testConnection as testRedis } from './src/config/redis.js';
import { errorHandler, notFound } from './src/middleware/errorHandler.js';
import { startPublishWorker } from './src/workers/publishWorker.js';
import { startDuePostsJob } from './src/cron/duePosts.js';
import { startTokenRefreshJob } from './src/cron/tokenRefresh.js';
import logger from './src/utils/logger.js';

import authRoutes from './src/routes/auth.js';
import usersRoutes from './src/routes/users.js';
import clientsRoutes from './src/routes/clients.js';
import metaRoutes from './src/routes/meta.js';
import mediaRoutes from './src/routes/media.js';
import postsRoutes from './src/routes/posts.js';
import settingsRoutes, { loadSettingsToEnv } from './src/routes/settings.js';
import insightsRoutes from './src/routes/insights.js';
import aiRoutes from './src/routes/ai.js';
import automationRoutes from './src/routes/automation.js';
import { R2Service } from './src/services/r2Service.js';

const app = express();
const PORT = process.env.PORT || 4000;

async function runMigrations() {
  await query(`
    CREATE TABLE IF NOT EXISTS reel_triggers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id INT NOT NULL,
      social_account_id INT NOT NULL,
      media_id VARCHAR(255) NULL,
      media_url VARCHAR(500) NULL,
      media_thumbnail VARCHAR(500) NULL,
      keyword VARCHAR(255) NULL,
      trigger_type ENUM('comment','dm') DEFAULT 'comment',
      match_any TINYINT(1) DEFAULT 0,
      reply_every TINYINT(1) DEFAULT 0,
      ignore_own TINYINT(1) DEFAULT 1,
      confirm_text TEXT NULL,
      confirm_button VARCHAR(20) NULL,
      link_text TEXT NOT NULL,
      link_url VARCHAR(500) NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (social_account_id) REFERENCES social_accounts(id) ON DELETE CASCADE
    )
  `);
  logger.info('Migrations: reel_triggers table ready');
}

// ── Security & Middleware ────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    usersRoutes);
app.use('/api/clients',  clientsRoutes);
app.use('/api/meta',     metaRoutes);
app.use('/api/media',    mediaRoutes);
app.use('/api/posts',    postsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/ai',         aiRoutes);
app.use('/api/automation', automationRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use(notFound);
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    await testRedis();
    await loadSettingsToEnv();
    await runMigrations();

    // Configure R2 CORS so browser can upload directly via presigned URLs
    if (process.env.R2_ACCOUNT_ID) {
      R2Service.configureCors(process.env.FRONTEND_URL || 'https://posting.officialaiagent.in')
        .catch(e => logger.warn('R2 CORS config skipped', { error: e.message }));
    }

    startPublishWorker();
    startDuePostsJob();
    startTokenRefreshJob();

    app.listen(PORT, () => {
      logger.info(`ODM Scheduler API listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    logger.error('Startup failed', { error: err.message });
    process.exit(1);
  }
}

start();
