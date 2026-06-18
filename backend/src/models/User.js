import { query, queryOne } from '../config/database.js';

const SAFE_FIELDS = 'id, name, email, role, avatar_url, is_active, created_at';

export const UserModel = {
  findById: (id) => queryOne(`SELECT ${SAFE_FIELDS} FROM users WHERE id = ?`, [id]),

  findByEmail: (email) => queryOne('SELECT * FROM users WHERE email = ?', [email]),

  findAll: () => query(`SELECT ${SAFE_FIELDS} FROM users ORDER BY created_at DESC`),

  create: ({ name, email, password_hash, role = 'member' }) =>
    query('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [name, email, password_hash, role]),

  update: (id, fields) => {
    const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
    return query(`UPDATE users SET ${sets} WHERE id = ?`, [...Object.values(fields), id]);
  },

  deactivate: (id) => query('UPDATE users SET is_active = 0 WHERE id = ?', [id]),

  getClientAccess: (userId) =>
    query(
      `SELECT c.id, c.name, c.logo_url, c.status FROM clients c
       JOIN client_team_access cta ON cta.client_id = c.id
       WHERE cta.user_id = ?`,
      [userId]
    ),
};
