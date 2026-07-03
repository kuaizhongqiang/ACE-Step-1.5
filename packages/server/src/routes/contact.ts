import { Router, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { adminMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message, category } = req.body as any;
    if (!name || !email || !subject || !message) { res.status(400).json({ error: 'All fields are required' }); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(400).json({ error: 'Invalid email address' }); return; }
    if (message.length > 5000) { res.status(400).json({ error: 'Message too long (max 5000 characters)' }); return; }
    const result = await pool.query(
      `INSERT INTO contact_submissions (name, email, subject, message, category)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [name, email, subject, message, category || 'general'],
    );
    res.status(201).json({ success: true, message: 'Your message has been sent.', id: result.rows[0].id });
  } catch (error) { res.status(500).json({ error: 'Failed to send message.' }); }
});

router.get('/admin', adminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT id, name, email, subject, message, category, is_read, created_at FROM contact_submissions ORDER BY created_at DESC LIMIT 100');
    res.json({ submissions: result.rows });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

router.patch('/admin/:id/read', adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isRead } = req.body;
    const result = await pool.query('UPDATE contact_submissions SET is_read = $1 WHERE id = $2 RETURNING is_read', [isRead, req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Submission not found' }); return; }
    res.json({ success: true, isRead: result.rows[0].is_read });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/admin/:id', adminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM contact_submissions WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) { res.status(404).json({ error: 'Submission not found' }); return; }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/admin/unread-count', adminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM contact_submissions WHERE is_read = FALSE');
    res.json({ count: parseInt(result.rows[0].count, 10) });
  } catch (error) { res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
