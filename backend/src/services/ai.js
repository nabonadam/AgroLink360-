// AI/data-science layer.
//
// Each function tries the Python microservice (AI_SERVICE_URL) first and falls
// back to a transparent heuristic so the API works out-of-the-box with no ML
// stack running. Swap the heuristics for real models as you collect data.

const AI_URL = process.env.AI_SERVICE_URL;

async function callPython(path, payload) {
  if (!AI_URL) return null;
  try {
    const r = await fetch(`${AI_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null; // service down → use heuristic
  }
}

// Base per-unit reference prices (GH₵) for the Ashanti vegetable corridor
const BASE_PRICE = {
  tomatoes: 140, 'garden eggs': 130, 'sweet pepper': 115, pepper: 115,
  cabbage: 15, okro: 60, onion: 320, lettuce: 25, carrot: 90,
};

// Shelf-life in days, drives freshness + spoilage risk
const SHELF_LIFE = {
  tomatoes: 7, 'garden eggs': 10, 'sweet pepper': 12, pepper: 12,
  cabbage: 14, okro: 5, onion: 60, lettuce: 4, carrot: 21,
};

const key = (s) => String(s || '').trim().toLowerCase();

// ── Price prediction ────────────────────────────────────
export async function predictPrice({ produce, market = 'Kumasi Central', horizonDays = 14 }) {
  const remote = await callPython('/price', { produce, market, horizon_days: horizonDays });
  if (remote) return remote;

  const base = BASE_PRICE[key(produce)] ?? 100;
  // Simple seasonal sine + mild upward drift
  const t = horizonDays / 30;
  const seasonal = Math.sin(t * Math.PI) * 0.12;
  const drift = 0.03 * t;
  const predicted = Math.round(base * (1 + seasonal + drift));
  return {
    produce, market, horizon_days: horizonDays,
    current_ghs: base,
    predicted_ghs: predicted,
    change_pct: Math.round(((predicted - base) / base) * 100),
    confidence: 0.82,
    method: 'heuristic',
  };
}

// ── Harvest window prediction ───────────────────────────
export async function predictHarvest({ produce, plantedDate }) {
  const remote = await callPython('/harvest', { produce, planted_date: plantedDate });
  if (remote) return remote;

  const DAYS_TO_MATURITY = { tomatoes: 75, 'garden eggs': 80, pepper: 70, cabbage: 90, okro: 55, onion: 120 };
  const days = DAYS_TO_MATURITY[key(produce)] ?? 80;
  const planted = plantedDate ? new Date(plantedDate) : new Date();
  const start = new Date(planted.getTime() + days * 864e5);
  const end = new Date(start.getTime() + 7 * 864e5);
  return {
    produce,
    best_window_start: start.toISOString().slice(0, 10),
    best_window_end: end.toISOString().slice(0, 10),
    est_yield_note: 'Depends on plot size; supply acreage for a volume estimate',
    confidence: 0.86,
    method: 'heuristic',
  };
}

// ── Freshness score (0–100) ─────────────────────────────
export async function freshnessScore({ produce, harvestDate }) {
  const remote = await callPython('/freshness', { produce, harvest_date: harvestDate });
  if (remote) return remote.score;

  const shelf = SHELF_LIFE[key(produce)] ?? 7;
  const daysOld = harvestDate ? Math.max(0, (Date.now() - new Date(harvestDate)) / 864e5) : 1;
  const score = Math.round(Math.max(40, 100 - (daysOld / shelf) * 60));
  return score;
}

// ── Spoilage risk → delivery priority ───────────────────
export async function spoilageRisk({ produce, etaMinutes = 30 }) {
  const remote = await callPython('/spoilage-risk', { produce, eta_minutes: etaMinutes });
  if (remote) return remote;

  const shelf = SHELF_LIFE[key(produce)] ?? 7;
  // Shorter shelf-life + longer transit ⇒ higher risk
  const riskScore = (1 / shelf) * (etaMinutes / 30);
  const priority = riskScore > 0.18 ? 'high' : riskScore > 0.08 ? 'medium' : 'low';
  return { produce, risk_score: Number(riskScore.toFixed(3)), priority, method: 'heuristic' };
}

// ── Delivery cost / ETA estimate ────────────────────────
export async function estimateDelivery({ listing, quantity }) {
  // Without precise coordinates we use a corridor average; replace with PostGIS
  // ST_Distance once buyer & farm geolocation are populated.
  const distance_km = 14;
  const ratePerKm = 6; // GH₵/km for a tricycle load
  const cost_ghs = Math.round(distance_km * ratePerKm + Number(quantity) * 2);
  const eta_minutes = Math.round(distance_km * 1.7); // ~35 km/h average on rural roads
  return { distance_km, cost_ghs, eta_minutes };
}

// ── Shared-delivery / route consolidation ───────────────
export function consolidateRoutes(requests) {
  // Group open requests by pickup community; any group >1 can be combined.
  const groups = {};
  for (const r of requests) {
    const k = r.pickup_area || 'Unknown';
    (groups[k] ||= []).push(r);
  }
  const suggestions = Object.entries(groups)
    .filter(([, items]) => items.length > 1)
    .map(([area, items]) => {
      const solo = items.reduce((s, i) => s + Number(i.cost_ghs || 0), 0);
      const combined = Math.round(solo * 0.62); // ~38% saving from one shared trip
      return {
        pickup_area: area,
        stops: items.length,
        produce: items.map((i) => i.produce),
        solo_cost_ghs: Math.round(solo),
        combined_cost_ghs: combined,
        saving_ghs: Math.round(solo - combined),
      };
    });
  return { suggestions };
}
