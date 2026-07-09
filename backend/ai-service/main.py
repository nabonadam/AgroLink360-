"""
AgroLink360 — AI microservice (FastAPI)

Implements the data-science components from the proposal:
  • Dynamic price prediction
  • Harvest-window prediction
  • Freshness estimation
  • Spoilage-risk prediction

Models are trained on synthetic seasonal data at startup so the service runs
immediately. Replace `_train_*` with real fits on your historical data
(scikit-learn / XGBoost) as it accumulates.

Run:
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000
"""
from datetime import date, datetime, timedelta

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from sklearn.linear_model import LinearRegression

app = FastAPI(title="AgroLink360 AI", version="0.1.0")

BASE_PRICE = {
    "tomatoes": 140, "garden eggs": 130, "sweet pepper": 115, "pepper": 115,
    "cabbage": 15, "okro": 60, "onion": 320, "lettuce": 25, "carrot": 90,
}
SHELF_LIFE = {
    "tomatoes": 7, "garden eggs": 10, "sweet pepper": 12, "pepper": 12,
    "cabbage": 14, "okro": 5, "onion": 60, "lettuce": 4, "carrot": 21,
}
DAYS_TO_MATURITY = {
    "tomatoes": 75, "garden eggs": 80, "pepper": 70, "cabbage": 90, "okro": 55, "onion": 120,
}


def _norm(s: str) -> str:
    return (s or "").strip().lower()


# ── Price model: fit a tiny regression on synthetic seasonal history ──
_price_models: dict[str, LinearRegression] = {}


def _train_price_models():
    for produce, base in BASE_PRICE.items():
        days = np.arange(0, 90)
        # seasonal sine + slight drift + noise
        y = base * (1 + 0.15 * np.sin(days / 12) + 0.0008 * days) + np.random.normal(0, base * 0.02, days.shape)
        X = np.column_stack([days, np.sin(days / 12), np.cos(days / 12)])
        model = LinearRegression().fit(X, y)
        _price_models[produce] = model


_train_price_models()


class PriceReq(BaseModel):
    produce: str
    market: str = "Kumasi Central"
    horizon_days: int = 14


@app.post("/price")
def price(req: PriceReq):
    p = _norm(req.produce)
    base = BASE_PRICE.get(p, 100)
    model = _price_models.get(p)
    if model is None:
        predicted = base
        conf = 0.6
    else:
        d = 90 + req.horizon_days
        X = np.array([[d, np.sin(d / 12), np.cos(d / 12)]])
        predicted = float(model.predict(X)[0])
        conf = 0.88
    return {
        "produce": req.produce,
        "market": req.market,
        "horizon_days": req.horizon_days,
        "current_ghs": round(base, 2),
        "predicted_ghs": round(predicted, 2),
        "change_pct": round((predicted - base) / base * 100, 1),
        "confidence": conf,
        "method": "linear_regression",
    }


class HarvestReq(BaseModel):
    produce: str
    planted_date: str | None = None


@app.post("/harvest")
def harvest(req: HarvestReq):
    p = _norm(req.produce)
    days = DAYS_TO_MATURITY.get(p, 80)
    planted = datetime.fromisoformat(req.planted_date).date() if req.planted_date else date.today()
    start = planted + timedelta(days=days)
    end = start + timedelta(days=7)
    return {
        "produce": req.produce,
        "best_window_start": start.isoformat(),
        "best_window_end": end.isoformat(),
        "days_to_maturity": days,
        "confidence": 0.86,
        "method": "agronomic_baseline",
    }


class FreshnessReq(BaseModel):
    produce: str
    harvest_date: str | None = None


@app.post("/freshness")
def freshness(req: FreshnessReq):
    p = _norm(req.produce)
    shelf = SHELF_LIFE.get(p, 7)
    if req.harvest_date:
        days_old = max(0.0, (date.today() - datetime.fromisoformat(req.harvest_date).date()).days)
    else:
        days_old = 1.0
    score = int(max(40, 100 - (days_old / shelf) * 60))
    return {"produce": req.produce, "score": score, "days_old": days_old, "shelf_life_days": shelf}


class SpoilageReq(BaseModel):
    produce: str
    eta_minutes: int = 30


@app.post("/spoilage-risk")
def spoilage(req: SpoilageReq):
    p = _norm(req.produce)
    shelf = SHELF_LIFE.get(p, 7)
    risk = (1 / shelf) * (req.eta_minutes / 30)
    priority = "high" if risk > 0.18 else "medium" if risk > 0.08 else "low"
    return {"produce": req.produce, "risk_score": round(risk, 3), "priority": priority}


@app.get("/health")
def health():
    return {"ok": True, "service": "agrolink360-ai"}
