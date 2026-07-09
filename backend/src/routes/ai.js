import { Router } from 'express';
import { predictPrice, predictHarvest, spoilageRisk } from '../services/ai.js';

const router = Router();

// GET /api/ai/price?produce=Tomatoes&market=Kumasi%20Central&horizon=14
router.get('/price', async (req, res, next) => {
  try {
    const { produce, market, horizon } = req.query;
    if (!produce) return res.status(400).json({ error: 'produce is required' });
    res.json(await predictPrice({ produce, market, horizonDays: horizon ? Number(horizon) : 14 }));
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/harvest?produce=Tomatoes&planted=2026-05-01
router.get('/harvest', async (req, res, next) => {
  try {
    const { produce, planted } = req.query;
    if (!produce) return res.status(400).json({ error: 'produce is required' });
    res.json(await predictHarvest({ produce, plantedDate: planted }));
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/spoilage?produce=Tomatoes&eta=40
router.get('/spoilage', async (req, res, next) => {
  try {
    const { produce, eta } = req.query;
    if (!produce) return res.status(400).json({ error: 'produce is required' });
    res.json(await spoilageRisk({ produce, etaMinutes: eta ? Number(eta) : 30 }));
  } catch (err) {
    next(err);
  }
});

export default router;
