import { Router } from 'express';
import { z } from 'zod';
import { pool, q } from '../db.js';
import { authRequired, requireRole } from '../auth.js';
import { estimateDelivery, spoilageRisk } from '../services/ai.js';

const router = Router();

const orderSchema = z.object({
  listing_id: z.string().uuid(),
  quantity: z.number().positive(),
});

// POST /api/orders — buyer places an order (transactional)
router.post('/', authRequired, requireRole('buyer'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { listing_id, quantity } = orderSchema.parse(req.body);
    await client.query('BEGIN');

    // Lock the listing row to avoid overselling
    const { rows: lr } = await client.query(
      'SELECT * FROM produce_listings WHERE id = $1 FOR UPDATE',
      [listing_id]
    );
    const listing = lr[0];
    if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 });
    if (Number(listing.quantity) < quantity)
      throw Object.assign(new Error('Insufficient quantity available'), { status: 409 });

    const total = (Number(listing.price_ghs) * quantity).toFixed(2);
    const ref = 'AL-' + Math.floor(2382 + Math.random() * 7000);

    const { rows: orows } = await client.query(
      `INSERT INTO orders (ref, buyer_id, farmer_id, listing_id, quantity, unit, total_ghs, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed') RETURNING *`,
      [ref, req.user.id, listing.farmer_id, listing_id, quantity, listing.unit, total]
    );
    const order = orows[0];

    // Decrement stock
    const remaining = Number(listing.quantity) - quantity;
    await client.query(
      `UPDATE produce_listings SET quantity = $1, status = $2, updated_at = now() WHERE id = $3`,
      [remaining, remaining <= 0 ? 'sold_out' : listing.status, listing_id]
    );

    // Spin up a delivery request with an AI cost/ETA estimate
    const est = await estimateDelivery({ listing, quantity });
    const risk = await spoilageRisk({ produce: listing.name, etaMinutes: est.eta_minutes });
    const { rows: drows } = await client.query(
      `INSERT INTO deliveries (order_id, status, distance_km, cost_ghs, eta_minutes, priority)
       VALUES ($1,'requested',$2,$3,$4,$5) RETURNING *`,
      [order.id, est.distance_km, est.cost_ghs, est.eta_minutes, risk.priority]
    );
    await client.query(
      `INSERT INTO delivery_events (delivery_id, status, note) VALUES ($1,'requested','Order placed by buyer')`,
      [drows[0].id]
    );

    await client.query('COMMIT');
    res.status(201).json({ order, delivery: drows[0], payment_required: total });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// GET /api/orders — current user's orders (buyer: placed, farmer: received)
router.get('/', authRequired, async (req, res, next) => {
  try {
    const col = req.user.role === 'farmer' ? 'farmer_id' : 'buyer_id';
    const { rows } = await q(
      `SELECT o.*, pl.name AS produce_name,
              bu.name AS buyer_name, fa.name AS farmer_name,
              d.status AS delivery_status, d.eta_minutes
       FROM orders o
       JOIN produce_listings pl ON pl.id = o.listing_id
       JOIN users bu ON bu.id = o.buyer_id
       JOIN users fa ON fa.id = o.farmer_id
       LEFT JOIN deliveries d ON d.order_id = o.id
       WHERE o.${col} = $1
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/orders/:id/status
router.patch('/:id/status', authRequired, async (req, res, next) => {
  try {
    const { status } = z
      .object({ status: z.enum(['confirmed', 'awaiting_pickup', 'in_transit', 'delivered', 'cancelled']) })
      .parse(req.body);
    const { rows } = await q(
      `UPDATE orders SET status = $1 WHERE id = $2 AND (buyer_id = $3 OR farmer_id = $3) RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
