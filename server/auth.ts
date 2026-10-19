import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

const SESSION_SECRET = process.env.SESSION_SECRET || 'solaris_reef_secure_session_token_key_change_in_production';

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export function createToken(userId: string): string {
  const payload = `${userId}:${Date.now()}`;
  const hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;
    const [userId, timestampStr, signature] = parts;
    const timestamp = parseInt(timestampStr, 10);
    // Session validity: 7 days
    if (Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) return null;

    const payload = `${userId}:${timestampStr}`;
    const hmac = crypto.createHmac('sha256', SESSION_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return userId;
    }
    return null;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  adminUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check cookie or Authorization Bearer header
  const token = req.cookies?.admin_token || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
  }

  const userId = verifyToken(token);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
  }

  const admin = db.getAdminById(userId);
  if (!admin) {
    return res.status(401).json({ error: 'Unauthorized: Admin account not found' });
  }

  req.adminUser = {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };

  next();
}
