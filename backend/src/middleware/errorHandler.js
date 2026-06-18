import logger from '../utils/logger.js';
import { ApiError } from '../utils/apiError.js';

export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Validation errors from express-validator
  if (err.type === 'validation') {
    return res.status(400).json({ success: false, message: 'Validation failed', details: err.errors });
  }

  logger.error('Unhandled error', {
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({ success: false, message: 'Internal server error' });
}

export function notFound(req, res) {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
}
