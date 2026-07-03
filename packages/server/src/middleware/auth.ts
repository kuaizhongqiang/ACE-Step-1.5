import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool.js';

export interface AuthenticatedUser {
  id: string;
  username: string;
  isAdmin?: boolean;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

async function getDefaultUser(): Promise<AuthenticatedUser | null> {
  try {
    const result = await pool.query(
      'SELECT id, username, is_admin FROM users ORDER BY created_at ASC LIMIT 1',
    );
    if (result.rows.length === 0) return null;
    const u = result.rows[0];
    return { id: u.id, username: u.username, isAdmin: Boolean(u.is_admin) };
  } catch {
    return null;
  }
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getDefaultUser();
  if (!user) {
    res.status(503).json({ error: 'No user configured. Run server setup first.' });
    return;
  }
  req.user = user;
  next();
}

export async function optionalAuthMiddleware(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  req.user = (await getDefaultUser()) || undefined;
  next();
}

export async function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const user = await getDefaultUser();
  if (!user || !user.isAdmin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  req.user = user;
  next();
}
