import { Router } from 'express';
import { z } from 'zod';
import { q } from '../db.js';
import { authRequired } from '../auth.js';
import { initiateCollection, collectionStatus } from '../services/momo.js';

const router = Router();

const paySchema = z.object({
  order_id: z.string().uuid(),
  provider: z.enum(['mtn_momo', 'vodafone_cash', 'airteltigo']).default('mtn_momo'),
  msisdn: z.string().min(7),
});

// POST /api/payments/momo — request payment for an order
router.post('/momo', authRequired, async (req, res, next) => {
  try {
    const { order_id, provider, msisdn } = paySchema.parse(req.body);
    const { rows: or } = await q('SELECT * FROM orders WHERE id = $1 AND buyer_id = $2', [order_id, req.user.id]);
    const order = or[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const collection = await initiateCollection({
      amount: Number(order.total_ghs),
      msisdn,
      externalId: order.ref,
      payerMessage: `AgroLink360 order ${order.ref}`,
    });

    const { rows } = await q(
      `INSERT INTO payments (order_id, provider, msisdn, amount_ghs, status, external_ref)
       VALUES ($1,$2,$3,$4,'pending',$5) RETURNING *`,
      [order_id, provider, msisdn, order.total_ghs, collection.ref]
    );
    res.status(201).json({ payment: rows[0], simulated: collection.simulated === true });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/:ref/status — poll & reconcile
router.get('/:ref/status', authRequired, async (req, res, next) => {
  try {
    const { rows } = await q('SELECT * FROM payments WHERE external_ref = $1', [req.params.ref]);
    const payment = rows[0];
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    if (payment.status === 'pending') {
      const remote = await collectionStatus(req.params.ref);
      if (remote.status === 'successful') {
        await q(`UPDATE payments SET status = 'successful' WHERE id = $1`, [payment.id]);
        await q(`UPDATE orders SET status = 'confirmed' WHERE id = $1`, [payment.order_id]);
        payment.status = 'successful';
      }
    }
    res.json({ payment });
  } catch (err) {
    next(err);
  }
});

// POST /api/payments/momo/callback — MoMo webhook (no auth; verify signature in prod)
router.post('/momo/callback', async (req, res, next) => {
  try {
    const { externalRef, status } = req.body || {};
    if (externalRef && status === 'SUCCESSFUL') {
      const { rows } = await q(`UPDATE payments SET status='successful' WHERE external_ref=$1 RETURNING order_id`, [
        externalRef,
      ]);
      if (rows.length) await q(`UPDATE orders SET status='confirmed' WHERE id=$1`, [rows[0].order_id]);
    }
    res.json({ received: true });
  } catch (err) {
    next(err);
  }
});

export default router;
