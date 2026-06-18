import { query, queryOne, transaction } from '../config/database.js';

export const PostModel = {
  findById: (id) =>
    queryOne(
      `SELECT p.*, u.name AS author_name, c.name AS client_name
       FROM posts p
       JOIN users u ON u.id = p.created_by
       JOIN clients c ON c.id = p.client_id
       WHERE p.id = ?`,
      [id]
    ),

  findByClient: (clientId, { status, limit = 50, offset = 0 } = {}) => {
    const where = status ? 'AND p.status = ?' : '';
    const params = status ? [clientId, status, limit, offset] : [clientId, limit, offset];
    return query(
      `SELECT p.*, u.name AS author_name
       FROM posts p JOIN users u ON u.id = p.created_by
       WHERE p.client_id = ? ${where}
       ORDER BY COALESCE(p.scheduled_time, p.created_at) DESC
       LIMIT ? OFFSET ?`,
      params
    );
  },

  findScheduledBefore: (cutoff) =>
    query(
      "SELECT * FROM posts WHERE status = 'scheduled' AND scheduled_time <= ?",
      [cutoff]
    ),

  create: ({ client_id, caption, content_type, status, scheduled_time, timezone, created_by }) =>
    query(
      'INSERT INTO posts (client_id, caption, content_type, status, scheduled_time, timezone, created_by) VALUES (?,?,?,?,?,?,?)',
      [client_id, caption, content_type, status || 'draft', scheduled_time || null, timezone || 'Asia/Kolkata', created_by]
    ),

  update: (id, fields) => {
    const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
    return query(`UPDATE posts SET ${sets} WHERE id = ?`, [...Object.values(fields), id]);
  },

  delete: (id) => query('DELETE FROM posts WHERE id = ?', [id]),

  getMedia: (postId) =>
    query('SELECT * FROM post_media WHERE post_id = ? ORDER BY order_index ASC', [postId]),

  addMedia: ({ post_id, media_url, media_type, order_index, r2_key, file_size, mime_type, width, height, duration_s }) =>
    query(
      'INSERT INTO post_media (post_id, media_url, media_type, order_index, r2_key, file_size, mime_type, width, height, duration_s) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [post_id, media_url, media_type, order_index, r2_key, file_size, mime_type, width, height, duration_s]
    ),

  clearMedia: (postId) => query('DELETE FROM post_media WHERE post_id = ?', [postId]),

  getPlatforms: (postId) =>
    query(
      `SELECT pp.*, sa.platform, sa.account_name, sa.username, sa.profile_pic_url
       FROM post_platforms pp
       JOIN social_accounts sa ON sa.id = pp.social_account_id
       WHERE pp.post_id = ?`,
      [postId]
    ),

  addPlatform: (postId, socialAccountId) =>
    query('INSERT IGNORE INTO post_platforms (post_id, social_account_id) VALUES (?, ?)', [postId, socialAccountId]),

  updatePlatformStatus: (id, { publish_status, platform_post_id, error_log, published_at }) =>
    query(
      'UPDATE post_platforms SET publish_status = ?, platform_post_id = ?, error_log = ?, published_at = ?, attempt_count = attempt_count + 1, updated_at = NOW() WHERE id = ?',
      [publish_status, platform_post_id || null, error_log || null, published_at || null, id]
    ),

  // Calendar range query
  findInRange: (clientId, startDate, endDate, userRole, userId) => {
    const clientFilter = clientId ? 'AND p.client_id = ?' : '';
    const clientParam = clientId ? [clientId] : [];
    return query(
      `SELECT p.id, p.client_id, p.caption, p.content_type, p.status, p.scheduled_time,
              c.name AS client_name, c.logo_url AS client_logo
       FROM posts p JOIN clients c ON c.id = p.client_id
       WHERE p.scheduled_time BETWEEN ? AND ? ${clientFilter}
       ORDER BY p.scheduled_time ASC`,
      [startDate, endDate, ...clientParam]
    );
  },

  getStats: (clientId) =>
    queryOne(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'published') AS published,
         SUM(status = 'scheduled') AS scheduled,
         SUM(status = 'draft') AS drafts,
         SUM(status = 'failed') AS failed,
         SUM(status = 'partially_failed') AS partially_failed
       FROM posts WHERE client_id = ?`,
      [clientId]
    ),
};
