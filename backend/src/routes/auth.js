import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { q } from '../db.js';
import { signToken, authRequired } from '../auth.js';

const router = Router();

const registerSchema = z.object({
  role: z.enum(['farmer', 'buyer', 'transporter']),
  name: z.string().min(2),
  phone: z.string().min(7),
  password: z.string().min(6),
  momo_number: z.string().optional(),
  lang: z.enum(['en', 'twi', 'dagbani', 'hausa']).optional(),
  community: z.string().optional(),
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const hash = await bcrypt.hash(data.password, 10);
    const { rows } = await q(
      `INSERT INTO users (role, name, phone, password_hash, momo_number, lang, community)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, role, name, phone, momo_number, lang, community, created_at`,
      [data.role, data.name, data.phone, hash, data.momo_number || null, data.lang || 'en', data.community || null]
    );
    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone already registered' });
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = z.object({ phone: z.string(), password: z.string() }).parse(req.body);
    const { rows } = await q('SELECT * FROM users WHERE phone = $1', [phone]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid phone or password' });
    }
    delete user.password_hash;
    res.json({ user, token: signToken(user) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authRequired, async (req, res, next) => {
  try {
    const { rows } = await q(
      'SELECT id, role, name, phone, momo_number, lang, community, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
