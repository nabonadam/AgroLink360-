# AgroLink360 — Frontend / Backend Integration

How the frontend, API, database, and AI service fit together.

## System overview

The frontend calls the Node/Express API over REST. The API persists to
PostgreSQL/PostGIS and calls the Python AI service for predictions; if the AI
service is unreachable, the API falls back to built-in heuristics so the
frontend is never blocked on the ML stack.

```
Frontend (web / mobile)
   │  fetch + JWT bearer token
   ▼
Node/Express API :4000  ── auth · produce · orders · logistics · payments
   │                 │
   ▼                 ▼
PostgreSQL+PostGIS    Python AI service :8000 (price · harvest · freshness · spoilage)
                      + MTN MoMo Collection API (payments, escrow)
```

Local setup: `cd backend && docker compose up` (runs migrations and demo
seed data automatically). Demo accounts are listed in `backend/README.md`.

## Authentication

Phone-first auth, no email. Register/login returns a JWT sent as
`Authorization: Bearer <token>` on protected calls. Roles (farmer, buyer,
transporter, admin) are enforced server-side.

| Screen | Endpoint |
|---|---|
| Sign up | `POST /api/auth/register` |
| Log in | `POST /api/auth/login` |
| Session restore | `GET /api/auth/me` |

## Screen ↔ endpoint map

### Farmer
| Element | Endpoint |
|---|---|
| Dashboard KPIs | `GET /api/produce/mine`, `GET /api/orders` |
| Harvest assistant | `GET /api/ai/harvest`, `GET /api/ai/price` |
| My produce | `GET /api/produce/mine` |
| New listing | `POST /api/produce` (server assigns freshness score) |
| Orders received | `GET /api/orders` |
| Wallet | `GET /api/payments/...` per order |

### Buyer
| Element | Endpoint |
|---|---|
| Marketplace | `GET /api/produce?q=&category=&lat=&lng=` |
| Price/freshness context | `GET /api/ai/price` |
| Checkout | `POST /api/orders`, `POST /api/payments/momo` |
| Payment confirmation | `GET /api/payments/:ref/status` |
| Live tracking | `GET /api/logistics/deliveries/:id/track` |
| Order history | `GET /api/orders`, `PATCH /api/orders/:id/status` |

### Transport
| Element | Endpoint |
|---|---|
| Requests | `GET /api/logistics/requests` |
| Shared-delivery suggestion | `POST /api/logistics/optimize` |
| Accept request | `POST /api/logistics/requests/:id/accept` |
| Route status update | `PATCH /api/logistics/deliveries/:id/status` |

### Admin
Aggregates existing tables (users, listings, orders, deliveries, payments).
Add a role-guarded `/api/admin/stats` route as needed.

## AI models

| Model | Route | Data source | Used for |
|---|---|---|---|
| Price prediction | `POST /price` | price_history table | projected prices, market comparison |
| Harvest window | `POST /harvest` | planting dates, crop baselines | best-selling-window card |
| Freshness | `POST /freshness` | harvest date, crop shelf life | freshness bars, marketplace ranking |
| Spoilage risk | `POST /spoilage-risk` | shelf life × delivery ETA | delivery priority |
| Route consolidation | (Node) `/api/logistics/optimize` | open deliveries by pickup area | shared-delivery savings |

Current models are baseline regressions trained on seasonal data at service
startup. As real transaction data accumulates, retrain on the live
`price_history` table — the swap point is marked in `ai-service/main.py`.

## Example flow

```
POST /api/orders
{ "listing_id": "...", "quantity": 8 }
→ { "order": { "ref": "AL-2381", "total_ghs": "1120.00", "status": "confirmed" },
    "delivery": { "eta_minutes": 24, "cost_ghs": 95, "priority": "high" } }

POST /api/payments/momo
{ "order_id": "...", "msisdn": "+233241000010" }
→ { "payment": { "status": "pending", "external_ref": "..." } }

GET /api/payments/:ref/status
→ { "payment": { "status": "successful" } }
```

A browser client wrapping these calls is in `backend/client-example.js`.

## Build order

1. Auth
2. Marketplace read path
3. Farmer listings
4. Order + payment loop
5. Logistics
6. AI widgets
7. Ratings, live GPS, SMS/USSD gateway, production MoMo credentials
