import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError.js';
import { queryOne } from '../config/database.js';

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) throw ApiError.unauthorized();

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await queryOne(
      'SELECT id, name, email, role FROM users WHERE id = ? AND is_active = 1',
      [payload.userId]
    );
    if (!user) throw ApiError.unauthorized('User not found or inactive');

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    if (err.name === 'TokenExpiredError') return next(ApiError.unauthorized('Token expired'));
    if (err.name === 'JsonWebTokenError') return next(ApiError.unauthorized('Invalid token'));
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return next(ApiError.forbidden('Admin access required'));
  next();
}

export function requireAdminOrSelf(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.id === parseInt(req.params.userId)) return next();
  next(ApiError.forbidden());
}
