import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/clientAccess.js';
import { AuthService } from '../services/authService.js';
import { UserModel } from '../models/User.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use(authenticate, requireAdmin);

router.get('/', async (req, res, next) => {
  try {
    const users = await UserModel.findAll();
    res.json({ success: true, users });
  } catch (err) { next(err); }
});

router.post('/', validate([
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['admin', 'member']),
]), async (req, res, next) => {
  try {
    const result = await AuthService.createUser(req.body);
    res.status(201).json({ success: true, userId: result.insertId });
  } catch (err) { next(err); }
});

router.patch('/:id', validate([
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'member']),
]), async (req, res, next) => {
  try {
    const { name, role, avatar_url } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (role) updates.role = role;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    await UserModel.update(req.params.id, updates);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) throw ApiError.badRequest('Cannot deactivate yourself');
    await UserModel.deactivate(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
