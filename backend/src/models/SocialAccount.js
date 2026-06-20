import { query, queryOne } from '../config/database.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const toDate = (v) => (v ? new Date(v) : null);

export const SocialAccountModel = {
  findById: (id) => queryOne('SELECT * FROM social_accounts WHERE id = ?', [id]),

  findByClient: (clientId) =>
    query('SELECT * FROM social_accounts WHERE client_id = ? ORDER BY platform, account_name', [clientId]),

  findByPageId: (pageId) =>
    queryOne('SELECT * FROM social_accounts WHERE page_id = ?', [pageId]),

  // Returns decrypted token
  getToken: async (id) => {
    const row = await queryOne('SELECT access_token_encrypted FROM social_accounts WHERE id = ?', [id]);
    return row ? decrypt(row.access_token_encrypted) : null;
  },

  create: ({ client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, access_token, token_expires_at }) =>
    query(
      `INSERT INTO social_accounts
       (client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, access_token_encrypted, token_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, encrypt(access_token), toDate(token_expires_at)]
    ),

  // Insert or update existing account for same client+platform+page
  upsert: async ({ client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, access_token, token_expires_at }) => {
    const expires = toDate(token_expires_at);
    const existing = await queryOne(
      'SELECT id FROM social_accounts WHERE client_id = ? AND platform = ? AND page_id = ?',
      [client_id, platform, page_id]
    );
    if (existing) {
      await query(
        `UPDATE social_accounts SET ig_business_id=?, account_name=?, username=?, profile_pic_url=?,
         access_token_encrypted=?, token_expires_at=?, status='active', last_refreshed_at=NOW() WHERE id=?`,
        [ig_business_id, account_name, username, profile_pic_url, encrypt(access_token), expires, existing.id]
      );
      return { insertId: null, id: existing.id };
    }
    return query(
      `INSERT INTO social_accounts
       (client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, access_token_encrypted, token_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [client_id, platform, page_id, ig_business_id, account_name, username, profile_pic_url, encrypt(access_token), expires]
    );
  },

  updateToken: (id, access_token, token_expires_at) =>
    query(
      'UPDATE social_accounts SET access_token_encrypted = ?, token_expires_at = ?, last_refreshed_at = NOW(), status = ? WHERE id = ?',
      [encrypt(access_token), toDate(token_expires_at), 'active', id]
    ),

  updateStatus: (id, status) =>
    query('UPDATE social_accounts SET status = ? WHERE id = ?', [status, id]),

  disconnect: (id) =>
    query("UPDATE social_accounts SET status = 'disconnected' WHERE id = ?", [id]),

  findExpiringSoon: (daysAhead = 7) =>
    query(
      `SELECT * FROM social_accounts
       WHERE status = 'active' AND token_expires_at IS NOT NULL
         AND token_expires_at < DATE_ADD(NOW(), INTERVAL ? DAY)`,
      [daysAhead]
    ),

  // Safe representation (no encrypted token)
  toPublic: (account) => {
    const { access_token_encrypted, ...rest } = account;
    return rest;
  },
};
