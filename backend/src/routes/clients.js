import { Router } from 'express';
import { body } from 'express-validator';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate, requireClientAccess } from '../middleware/clientAccess.js';
import { ClientModel } from '../models/Client.js';
import { SocialAccountModel } from '../models/SocialAccount.js';
import { PostModel } from '../models/Post.js';
import { ApiError } from '../utils/apiError.js';

const router = Router();
router.use(authenticate);

// List clients (admin sees all, member sees assigned)
router.get('/', async (req, res, next) => {
  try {
    const clients = req.user.role === 'admin'
      ? await ClientModel.findAll()
      : await (await import('../models/User.js')).UserModel.getClientAccess(req.user.id);
    res.json({ success: true, clients });
  } catch (err) { next(err); }
});

router.post('/', requireAdmin, validate([
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('industry').optional().trim(),
  body('logo_url').optional().isURL(),
]), async (req, res, next) => {
  try {
    const result = await ClientModel.create({
      name: req.body.name,
      logo_url: req.body.logo_url || null,
      industry: req.body.industry || null,
      created_by: req.user.id,
    });
    res.status(201).json({ success: true, clientId: result.insertId });
  } catch (err) { next(err); }
});

router.get('/:clientId', requireClientAccess, async (req, res, next) => {
  try {
    const client = await ClientModel.findById(req.params.clientId);
    if (!client) throw ApiError.notFound('Client not found');

    const [accounts, team, stats] = await Promise.all([
      SocialAccountModel.findByClient(req.params.clientId),
      ClientModel.getTeamMembers(req.params.clientId),
      PostModel.getStats(req.params.clientId),
    ]);

    res.json({
      success: true,
      client,
      accounts: accounts.map(SocialAccountModel.toPublic),
      team,
      stats,
    });
  } catch (err) { next(err); }
});

router.patch('/:clientId', requireAdmin, validate([
  body('name').optional().trim().notEmpty(),
  body('status').optional().isIn(['active', 'inactive']),
]), async (req, res, next) => {
  try {
    const { name, logo_url, industry, status } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (logo_url !== undefined) updates.logo_url = logo_url;
    if (industry !== undefined) updates.industry = industry;
    if (status) updates.status = status;
    await ClientModel.update(req.params.clientId, updates);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:clientId', requireAdmin, async (req, res, next) => {
  try {
    await ClientModel.delete(req.params.clientId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Team access management (admin only)
router.post('/:clientId/team', requireAdmin, validate([
  body('userId').isInt(),
]), async (req, res, next) => {
  try {
    await ClientModel.grantAccess(req.body.userId, req.params.clientId, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.delete('/:clientId/team/:userId', requireAdmin, async (req, res, next) => {
  try {
    await ClientModel.revokeAccess(req.params.userId, req.params.clientId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
