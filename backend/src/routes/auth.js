import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/clientAccess.js';
import { authenticate } from '../middleware/auth.js';
import { AuthService } from '../services/authService.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();

router.post('/login', validate([
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
]), async (req, res, next) => {
  try {
    const result = await AuthService.login(req.body.email, req.body.password);
    res.json({ success: true, ...result });
  } catch (err) { next(err); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) throw ApiError.badRequest('refreshToken required');
    const tokens = await AuthService.refresh(refreshToken);
    res.json({ success: true, ...tokens });
  } catch (err) { next(err); }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await AuthService.logout(refreshToken);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await UserModel.findById(req.user.id);
    const clients = req.user.role === 'admin'
      ? await (await import('../models/Client.js')).ClientModel.findAll()
      : await UserModel.getClientAccess(req.user.id);
    res.json({ success: true, user, clients });
  } catch (err) { next(err); }
});

router.patch('/me/password', authenticate, validate([
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 8 }),
]), async (req, res, next) => {
  try {
    await AuthService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword);
    res.json({ success: true, message: 'Password updated' });
  } catch (err) { next(err); }
});

export default router;
