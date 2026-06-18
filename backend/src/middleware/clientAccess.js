import { queryOne } from '../config/database.js';
import { ApiError } from '../utils/apiError.js';

// Ensures req.user can access the client identified by req.params.clientId
export async function requireClientAccess(req, res, next) {
  try {
    const clientId = req.params.clientId || req.body.clientId;
    if (!clientId) return next(ApiError.badRequest('clientId is required'));

    if (req.user.role === 'admin') return next();

    const access = await queryOne(
      'SELECT 1 FROM client_team_access WHERE user_id = ? AND client_id = ?',
      [req.user.id, clientId]
    );
    if (!access) return next(ApiError.forbidden('No access to this client'));

    next();
  } catch (err) {
    next(err);
  }
}

export function validate(validations) {
  return async (req, res, next) => {
    for (const v of validations) await v.run(req);
    const { validationResult } = await import('express-validator');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const err = new Error('Validation failed');
      err.type = 'validation';
      err.errors = errors.array();
      return next(err);
    }
    next();
  };
}
