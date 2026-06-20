import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import { testConnection } from './src/config/database.js';
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

const app = express();
const PORT = process.env.PORT || 4000;

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

app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

app.use(notFound);
app.use(errorHandler);

// ── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  try {
    await testConnection();
    await testRedis();
    await loadSettingsToEnv();

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
