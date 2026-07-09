# AgroLink360 — Backend API

AI-powered farmer-to-buyer marketplace & smart logistics platform.
**Node.js + Express + PostgreSQL/PostGIS**, with a **Python (FastAPI)** AI microservice.

This is the server that powers the AgroLink360 prototype: farmer listings, the buyer
marketplace, order placement, delivery coordination, mobile-money payments, and the
AI/data-science endpoints (price prediction, harvest window, freshness, spoilage risk).

---

## Quick start

### Option A — Docker (everything at once)

```bash
cd backend
cp .env.example .env
docker compose up
```

This starts PostgreSQL+PostGIS, runs migrations + seed, launches the API on
`http://localhost:4000`, and the Python AI service on `http://localhost:8000`.

### Option B — Run locally

```bash
# 1. Postgres with PostGIS must be running and DATABASE_URL set in .env
cd backend
cp .env.example .env
npm install
npm run migrate     # create tables
npm run seed        # demo data (Ashanti corridor)
npm run dev         # API on http://localhost:4000

# 2. (optional) AI microservice — without it, the API uses built-in heuristics
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Demo logins (password: `password123`)

| Role        | Phone           |
|-------------|-----------------|
| Farmer      | `+233241000001` |
| Buyer       | `+233241000010` |
| Transporter | `+233241000020` |

---

## API overview

All routes are under `/api`. Auth via `Authorization: Bearer <token>` from login/register.

### Auth
| Method | Path                | Body / notes |
|--------|---------------------|--------------|
| POST   | `/auth/register`    | `{ role, name, phone, password, momo_number? }` |
| POST   | `/auth/login`       | `{ phone, password }` → `{ user, token }` |
| GET    | `/auth/me`          | current user |

### Produce / marketplace
| Method | Path             | Notes |
|--------|------------------|-------|
| GET    | `/produce`       | marketplace; `?q=&category=&lat=&lng=` — geo-ranked when lat/lng given |
| GET    | `/produce/mine`  | farmer's own listings |
| POST   | `/produce`       | create listing (farmer); AI assigns freshness score |
| PATCH  | `/produce/:id`   | update quantity / price / status |

### Orders
| Method | Path                  | Notes |
|--------|-----------------------|-------|
| POST   | `/orders`             | buyer places order (transactional: stock ↓, delivery request created) |
| GET    | `/orders`             | buyer sees placed, farmer sees received |
| PATCH  | `/orders/:id/status`  | update order status |

### Logistics
| Method | Path                                  | Notes |
|--------|---------------------------------------|-------|
| GET    | `/logistics/requests`                 | open deliveries, AI-prioritised by spoilage risk |
| POST   | `/logistics/requests/:id/accept`      | transporter accepts |
| POST   | `/logistics/optimize`                 | shared-delivery (route consolidation) suggestions |
| GET    | `/logistics/deliveries/:id/track`     | tracking timeline |
| PATCH  | `/logistics/deliveries/:id/status`    | driver progress updates |

### AI / data science
| Method | Path                              | Notes |
|--------|-----------------------------------|-------|
| GET    | `/ai/price?produce=Tomatoes`      | dynamic price prediction |
| GET    | `/ai/harvest?produce=&planted=`   | best harvest/selling window |
| GET    | `/ai/spoilage?produce=&eta=`      | spoilage risk → delivery priority |

### Payments (mobile money)
| Method | Path                          | Notes |
|--------|-------------------------------|-------|
| POST   | `/payments/momo`              | request MoMo collection for an order (simulated in sandbox) |
| GET    | `/payments/:ref/status`       | poll & reconcile → confirms order on success |
| POST   | `/payments/momo/callback`     | MoMo webhook |

---

## Architecture notes

- **PostGIS** powers geolocation: listings, farms, providers and deliveries store
  `GEOGRAPHY(Point, 4326)`. Marketplace distance ranking uses `ST_Distance`.
- **AI layer** (`src/services/ai.js`) calls the Python service when `AI_SERVICE_URL`
  is set, and otherwise falls back to transparent heuristics — so the API is never
  blocked on the ML stack. Swap heuristics for trained models incrementally.
- **MoMo** (`src/services/momo.js`) ships sandbox-simulated; the real MTN MoMo
  Collection calls are stubbed with inline instructions to wire production.
- **USSD/SMS offline access** (Twi/Dagbani/Hausa) from the proposal is not in this
  repo yet — add an SMS-gateway/USSD aggregator adapter that calls these same
  endpoints. The `users.lang` column and phone-based auth are already in place.

## Wiring the front-end

The prototype currently persists to `localStorage`. To point it at this API, replace
those reads/writes with `fetch` calls — see `client-example.js` for a drop-in client.

## Stack ↔ proposal mapping

| Proposal (Table 8)        | Here |
|---------------------------|------|
| Backend: Node.js+Express  | `src/` |
| Database: PostgreSQL+PostGIS | `db/schema.sql` |
| AI Engine: Python/sklearn/XGBoost | `ai-service/` |
| Payments: MTN MoMo API    | `src/services/momo.js` |
| Mapping: OpenStreetMap/Leaflet | client-side (front-end) |

## Project layout

```
backend/
├── db/schema.sql            PostGIS schema
├── src/
│   ├── server.js            Express app
│   ├── db.js  migrate.js  seed.js  auth.js
│   ├── routes/              auth, produce, orders, logistics, ai, payments
│   └── services/            ai.js (heuristics+ML), momo.js
├── ai-service/              FastAPI ML microservice
├── docker-compose.yml
└── client-example.js        front-end API client
```
