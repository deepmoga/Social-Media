import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../models/User.js';
import { query, queryOne } from '../config/database.js';
import { ApiError } from '../utils/apiError.js';

const TOKEN_EXP = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signAccess(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET, { expiresIn: TOKEN_EXP });
}

function signRefresh(userId) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXP });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const AuthService = {
  async login(email, password) {
    const user = await UserModel.findByEmail(email);
    if (!user || !user.is_active) throw ApiError.unauthorized('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw ApiError.unauthorized('Invalid credentials');

    const accessToken = signAccess(user.id, user.role);
    const refreshToken = signRefresh(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
      user.id, hashToken(refreshToken), expiresAt,
    ]);

    const { password_hash, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  },

  async refresh(refreshToken) {
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      throw ApiError.unauthorized('Invalid or expired refresh token');
    }

    const stored = await queryOne(
      'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > NOW()',
      [hashToken(refreshToken)]
    );
    if (!stored) throw ApiError.unauthorized('Refresh token revoked or expired');

    const user = await UserModel.findById(payload.userId);
    if (!user || !user.is_active) throw ApiError.unauthorized('User inactive');

    // Rotate: revoke old, issue new
    await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(refreshToken)]);

    const newAccess = signAccess(user.id, user.role);
    const newRefresh = signRefresh(user.id);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await query('INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)', [
      user.id, hashToken(newRefresh), expiresAt,
    ]);

    return { accessToken: newAccess, refreshToken: newRefresh };
  },

  async logout(refreshToken) {
    await query('DELETE FROM refresh_tokens WHERE token_hash = ?', [hashToken(refreshToken)]);
  },

  async changePassword(userId, currentPassword, newPassword) {
    const user = await queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw ApiError.unauthorized('Current password is incorrect');
    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [hash, userId]);
    // Revoke all refresh tokens
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  },

  async createUser({ name, email, password, role }) {
    const existing = await UserModel.findByEmail(email);
    if (existing) throw ApiError.conflict('Email already registered');
    const hash = await bcrypt.hash(password, 12);
    return UserModel.create({ name, email, password_hash: hash, role });
  },
};
