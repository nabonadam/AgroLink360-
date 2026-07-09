-- AgroLink360 — PostgreSQL + PostGIS schema
-- Run with:  npm run migrate   (executes this file)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ── Users ───────────────────────────────────────────────
-- One table, role-discriminated (farmer | buyer | transporter | admin)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role          TEXT NOT NULL CHECK (role IN ('farmer','buyer','transporter','admin')),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL UNIQUE,            -- E.164, e.g. +233241234567
  password_hash TEXT NOT NULL,
  momo_number   TEXT,                            -- mobile-money MSISDN
  lang          TEXT NOT NULL DEFAULT 'en' CHECK (lang IN ('en','twi','dagbani','hausa')),
  community     TEXT,
  location      GEOGRAPHY(Point, 4326),          -- lon/lat
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Farms (a farmer may have several plots) ─────────────
CREATE TABLE IF NOT EXISTS farms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  community  TEXT,
  location   GEOGRAPHY(Point, 4326),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Produce listings (the marketplace) ──────────────────
CREATE TABLE IF NOT EXISTS produce_listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id         UUID REFERENCES farms(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,                 -- "Tomatoes"
  category        TEXT,                          -- "Tomatoes" | "Leafy Greens" ...
  quantity        NUMERIC(10,2) NOT NULL,
  unit            TEXT NOT NULL,                 -- "crate" | "head" | "sack"
  price_ghs       NUMERIC(10,2) NOT NULL,        -- price per unit
  harvest_date    DATE,
  freshness_score INT CHECK (freshness_score BETWEEN 0 AND 100),
  status          TEXT NOT NULL DEFAULT 'listed'
                    CHECK (status IN ('listed','low_stock','spoilage_risk','sold_out','archived')),
  image_url       TEXT,
  location        GEOGRAPHY(Point, 4326),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_listings_geo  ON produce_listings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_listings_name ON produce_listings (lower(name));

-- ── Orders ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref         TEXT NOT NULL UNIQUE,              -- "AL-2382"
  buyer_id    UUID NOT NULL REFERENCES users(id),
  farmer_id   UUID NOT NULL REFERENCES users(id),
  listing_id  UUID NOT NULL REFERENCES produce_listings(id),
  quantity    NUMERIC(10,2) NOT NULL,
  unit        TEXT NOT NULL,
  total_ghs   NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','confirmed','awaiting_pickup','in_transit','delivered','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Transport providers ─────────────────────────────────
CREATE TABLE IF NOT EXISTS transport_providers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type TEXT NOT NULL,                    -- "tricycle" | "pickup" | "truck"
  plate        TEXT,
  capacity_kg  NUMERIC(10,2),
  available    BOOLEAN NOT NULL DEFAULT true,
  location     GEOGRAPHY(Point, 4326),
  rating       NUMERIC(2,1) DEFAULT 5.0
);

-- ── Deliveries ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider_id   UUID REFERENCES transport_providers(id),
  status        TEXT NOT NULL DEFAULT 'requested'
                  CHECK (status IN ('requested','accepted','picked_up','in_transit','delivered','failed')),
  pickup        GEOGRAPHY(Point, 4326),
  dropoff       GEOGRAPHY(Point, 4326),
  distance_km   NUMERIC(8,2),
  cost_ghs      NUMERIC(10,2),
  eta_minutes   INT,
  priority      TEXT DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
  status      TEXT NOT NULL,
  note        TEXT,
  at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Payments (mobile money) ─────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider    TEXT NOT NULL CHECK (provider IN ('mtn_momo','vodafone_cash','airteltigo')),
  msisdn      TEXT NOT NULL,
  amount_ghs  NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','successful','failed')),
  external_ref TEXT,                             -- ref returned by MoMo API
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Price history (feeds the AI price model) ────────────
CREATE TABLE IF NOT EXISTS price_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produce_name TEXT NOT NULL,
  market       TEXT NOT NULL,                    -- "Kumasi Central"
  unit         TEXT NOT NULL,
  price_ghs    NUMERIC(10,2) NOT NULL,
  recorded_on  DATE NOT NULL DEFAULT current_date
);
CREATE INDEX IF NOT EXISTS idx_price_hist ON price_history (lower(produce_name), recorded_on);
