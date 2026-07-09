import { Router } from 'express';
import { q } from '../db.js';
import { authRequired, requireRole } from '../auth.js';
import { consolidateRoutes } from '../services/ai.js';

const router = Router();

// GET /api/logistics/requests — open delivery requests, AI-prioritised
router.get('/requests', authRequired, requireRole('transporter', 'admin'), async (_req, res, next) => {
  try {
    const { rows } = await q(
      `SELECT d.id, d.status, d.distance_km, d.cost_ghs, d.eta_minutes, d.priority,
              o.ref, o.quantity, o.unit,
              pl.name AS produce, pl.community AS pickup_area,
              fa.name AS farmer, bu.name AS buyer
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN produce_listings pl ON pl.id = o.listing_id
       JOIN users fa ON fa.id = o.farmer_id
       JOIN users bu ON bu.id = o.buyer_id
       WHERE d.status = 'requested'
       ORDER BY CASE d.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, d.created_at`
    );
    res.json({ requests: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/logistics/requests/:id/accept — provider accepts a delivery
router.post('/requests/:id/accept', authRequired, requireRole('transporter'), async (req, res, next) => {
  try {
    const { rows: pr } = await q('SELECT id FROM transport_providers WHERE user_id = $1', [req.user.id]);
    if (!pr.length) return res.status(400).json({ error: 'No transport provider profile for this user' });

    const { rows } = await q(
      `UPDATE deliveries SET provider_id = $1, status = 'accepted'
       WHERE id = $2 AND status = 'requested' RETURNING *`,
      [pr[0].id, req.params.id]
    );
    if (!rows.length) return res.status(409).json({ error: 'Already accepted or not found' });

    await q(`INSERT INTO delivery_events (delivery_id, status, note) VALUES ($1,'accepted','Driver accepted')`, [
      rows[0].id,
    ]);
    await q(`UPDATE orders SET status = 'awaiting_pickup' WHERE id = $1`, [rows[0].order_id]);
    res.json({ delivery: rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/logistics/optimize — shared-delivery (route consolidation) suggestion
router.post('/optimize', authRequired, requireRole('transporter', 'admin'), async (_req, res, next) => {
  try {
    const { rows } = await q(
      `SELECT d.id, pl.community AS pickup_area, pl.name AS produce, o.quantity, o.unit, d.cost_ghs
       FROM deliveries d
       JOIN orders o ON o.id = d.order_id
       JOIN produce_listings pl ON pl.id = o.listing_id
       WHERE d.status = 'requested'`
    );
    res.json(consolidateRoutes(rows));
  } catch (err) {
    next(err);
  }
});

// GET /api/logistics/deliveries/:id/track — live tracking timeline
router.get('/deliveries/:id/track', authRequired, async (req, res, next) => {
  try {
    const { rows: dr } = await q('SELECT * FROM deliveries WHERE id = $1', [req.params.id]);
    if (!dr.length) return res.status(404).json({ error: 'Delivery not found' });
    const { rows: events } = await q(
      'SELECT status, note, at FROM delivery_events WHERE delivery_id = $1 ORDER BY at',
      [req.params.id]
    );
    res.json({ delivery: dr[0], events });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/logistics/deliveries/:id/status — driver updates progress
router.patch('/deliveries/:id/status', authRequired, requireRole('transporter'), async (req, res, next) => {
  try {
    const status = req.body.status;
    const valid = ['picked_up', 'in_transit', 'delivered', 'failed'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const { rows } = await q('UPDATE deliveries SET status = $1 WHERE id = $2 RETURNING *', [status, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Delivery not found' });
    await q('INSERT INTO delivery_events (delivery_id, status, note) VALUES ($1,$2,$3)', [
      req.params.id,
      status,
      req.body.note || null,
    ]);
    // Mirror onto the order
    const orderStatus = status === 'delivered' ? 'delivered' : status === 'in_transit' ? 'in_transit' : null;
    if (orderStatus) await q('UPDATE orders SET status = $1 WHERE id = $2', [orderStatus, rows[0].order_id]);
    res.json({ delivery: rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
