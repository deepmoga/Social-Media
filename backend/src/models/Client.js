import { query, queryOne } from '../config/database.js';

export const ClientModel = {
  findById: (id) =>
    queryOne('SELECT * FROM clients WHERE id = ?', [id]),

  findAll: () =>
    query('SELECT * FROM clients ORDER BY name ASC'),

  findByUser: (userId) =>
    query(
      `SELECT c.* FROM clients c
       JOIN client_team_access cta ON cta.client_id = c.id
       WHERE cta.user_id = ?
       ORDER BY c.name ASC`,
      [userId]
    ),

  create: ({ name, logo_url, industry, created_by }) =>
    query('INSERT INTO clients (name, logo_url, industry, created_by) VALUES (?, ?, ?, ?)', [
      name, logo_url, industry, created_by,
    ]),

  update: (id, fields) => {
    const sets = Object.keys(fields).map(k => `\`${k}\` = ?`).join(', ');
    return query(`UPDATE clients SET ${sets} WHERE id = ?`, [...Object.values(fields), id]);
  },

  delete: (id) => query('DELETE FROM clients WHERE id = ?', [id]),

  // Team access
  getTeamMembers: (clientId) =>
    query(
      `SELECT u.id, u.name, u.email, u.role, u.avatar_url, cta.granted_at
       FROM users u
       JOIN client_team_access cta ON cta.user_id = u.id
       WHERE cta.client_id = ?`,
      [clientId]
    ),

  grantAccess: (userId, clientId, grantedBy) =>
    query('INSERT IGNORE INTO client_team_access (user_id, client_id, granted_by) VALUES (?, ?, ?)', [
      userId, clientId, grantedBy,
    ]),

  revokeAccess: (userId, clientId) =>
    query('DELETE FROM client_team_access WHERE user_id = ? AND client_id = ?', [userId, clientId]),
};
