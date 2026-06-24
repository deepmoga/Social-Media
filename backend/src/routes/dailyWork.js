import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { query } from '../config/database.js';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!date) return res.json({ success: true, entries: [] });
    const entries = await query(
      'SELECT * FROM daily_work WHERE work_date = ?',
      [date]
    );
    res.json({ success: true, entries });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { date, clientId, done, comment } = req.body;
    if (!date || !clientId) return res.status(400).json({ success: false, message: 'date and clientId required' });
    const existing = await query(
      'SELECT id FROM daily_work WHERE work_date = ? AND client_id = ?',
      [date, clientId]
    );
    if (existing.length) {
      await query(
        'UPDATE daily_work SET done = ?, comment = ?, updated_by = ? WHERE id = ?',
        [done ? 1 : 0, comment || null, req.user.id, existing[0].id]
      );
    } else {
      await query(
        'INSERT INTO daily_work (work_date, client_id, done, comment, updated_by) VALUES (?, ?, ?, ?, ?)',
        [date, clientId, done ? 1 : 0, comment || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
