import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { authRequired, requireRole } from '../auth.js';
import { freshnessScore } from '../services/ai.js';

const router = Router();

// GET /api/produce  — marketplace listing with search, category & geo-ranking
// query: ?q=tomato&category=Tomatoes&lat=6.7&lng=-1.6&limit=24
router.get('/', async (req, res, next) => {
  try {
    const { q: search, category, lat, lng, limit = 24 } = req.query;
    const params = [];
    const where = [`pl.status NOT IN ('sold_out','archived')`];

    if (search) {
      params.push(`%${String(search).toLowerCase()}%`);
      where.push(`(lower(pl.name) LIKE $${params.length} OR lower(u.name) LIKE $${params.length})`);
    }
    if (category && category !== 'All') {
      params.push(category);
      where.push(`pl.category = $${params.length}`);
    }

    // Distance ranking when buyer location is supplied
    let distSelect = 'NULL::numeric AS dist_km';
    let orderBy = 'pl.freshness_score DESC NULLS LAST, pl.created_at DESC';
    if (lat && lng) {
      params.push(Number(lng), Number(lat));
      const pt = `ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`;
      distSelect = `ROUND((ST_Distance(pl.location, ${pt}) / 1000)::numeric, 1) AS dist_km`;
      orderBy = `dist_km ASC NULLS LAST, pl.freshness_score DESC`;
    }
    params.push(Number(limit));

    const { rows } = await q(
      `SELECT pl.id, pl.name, pl.category, pl.quantity, pl.unit, pl.price_ghs,
              pl.freshness_score, pl.status, pl.image_url,
              u.id AS farmer_id, u.name AS farmer, u.community AS location,
              ${distSelect}
       FROM produce_listings pl
       JOIN users u ON u.id = pl.farmer_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT $${params.length}`,
      params
    );
    res.json({ listings: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/produce/mine — a farmer's own listings
router.get('/mine', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    const { rows } = await q(
      `SELECT * FROM produce_listings WHERE farmer_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ listings: rows });
  } catch (err) {
    next(err);
  }
});

const listingSchema = z.object({
  name: z.string().min(2),
  category: z.string().optional(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  price_ghs: z.number().positive(),
  harvest_date: z.string().optional(),
  image_url: z.string().url().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

// POST /api/produce — create a listing (farmer)
router.post('/', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    const d = listingSchema.parse(req.body);
    // AI assigns a freshness score from produce type + days-since-harvest
    const score = await freshnessScore({ produce: d.name, harvestDate: d.harvest_date });
    const geo =
      d.lat != null && d.lng != null
        ? `ST_SetSRID(ST_MakePoint(${d.lng}, ${d.lat}), 4326)::geography`
        : 'NULL';

    const { rows } = await q(
      `INSERT INTO produce_listings
         (farmer_id, name, category, quantity, unit, price_ghs, harvest_date, freshness_score, image_url, location)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ${geo})
       RETURNING *`,
      [req.user.id, d.name, d.category || null, d.quantity, d.unit, d.price_ghs, d.harvest_date || null, score, d.image_url || null]
    );
    res.status(201).json({ listing: rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/produce/:id — update quantity/price/status (farmer, owner only)
router.patch('/:id', authRequired, requireRole('farmer'), async (req, res, next) => {
  try {
    const fields = ['quantity', 'price_ghs', 'status', 'image_url'];
    const updates = [];
    const params = [];
    for (const f of fields) {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    }
    if (!updates.length) return res.status(400).json({ error: 'No updatable fields supplied' });
    params.push(req.params.id, req.user.id);
    const { rows } = await q(
      `UPDATE produce_listings SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${params.length - 1} AND farmer_id = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Listing not found' });
    res.json({ listing: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
