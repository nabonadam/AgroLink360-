# AgroLink360 — App Walkthrough

Agro AI Nexus · Ashanti Region pilot · Ejisu, Akomadan, Offinso → Kumasi

This document walks through every screen of the AgroLink360 app: the public
site, sign up / log in, and the four logged-in workspaces (Farmer, Buyer,
Transport, Admin).

---

## 1. Overview

AgroLink360 is an AI-powered marketplace connecting smallholder vegetable
farmers directly to buyers, with AI-matched logistics, live delivery
tracking, and mobile-money payment.

The app is one responsive codebase:

- **Desktop** — top bar + sidebar layout
- **Mobile** — same app; below 820px the sidebar collapses into a bottom tab bar

There are three areas: the public landing page, the auth flow (sign up /
log in), and the logged-in workspace, which has four roles switchable from
the top bar — **Farmer, Buyer, Transport, Admin**.

---

## 2. Landing page

| Section | Contents |
|---|---|
| Header | Logo, nav links, Log in / Get started |
| Hero | Value proposition + pilot stats (1,284 farmers, GH₵ 212k June GMV, −31% post-harvest loss) |
| How it works | List produce → AI matches → Track delivery → Get paid |
| Who it's for | Farmer / Buyer / Transporter entry points |
| AI engine | Price prediction, demand forecasting, spoilage alerts, shared routes |
| Offline access | USSD *920*36#, SMS, Twi / Dagbani / Hausa / English |
| Footer | Brand info, platform links, contact, offline access |

The USSD banner reflects a core requirement: the marketplace has to work on
a basic feature phone with no data connection, not just a smartphone.

## 3. Sign up

1. **Role** — Farmer / Buyer / Transporter
2. **Details** — name, phone number, community, PIN
3. **Verify** — SMS one-time code

Phone number doubles as the mobile-money account, and a PIN (not a password)
keeps the flow consistent with USSD registration.

## 4. Log in

Phone + PIN, with a role selector for testing each workspace. Logging out
returns to the landing page.

---

## 5. Farmer workspace

### 5.1 Dashboard
- Listings, pending orders, monthly revenue, and spoilage alerts at a glance
- Revenue trend chart
- AI Harvest Assistant — projected best-selling window, estimated yield and
  price for the current crop
- Recent orders with status

### 5.2 My Produce
- Listing cards with quantity, price, and an AI freshness score
- Spoilage-risk items are flagged
- New-listing form includes an AI price suggestion based on current market data

### 5.3 Orders
- Open / completed orders, with a transport-request action for unshipped orders

### 5.4 Wallet
- Mobile-money balance, withdraw / cash out, and transaction history
- Payments are held in escrow until delivery is confirmed

---

## 6. Buyer workspace

### 6.1 Marketplace
- Produce ranked by AI freshness and distance from the buyer
- Search and category filters

### 6.2 Product page
- Farmer info, rating, AI freshness/price context
- Quantity selector with live order total

### 6.3 Checkout
- Mobile-money payment sheet with escrow explanation

### 6.4 Live tracking
- Delivery route, ETA, driver info, and a status timeline from pickup to delivery

### 6.5 Order history
- Past orders, ratings, and reorder

---

## 7. Transport workspace

### 7.1 Requests
- Open delivery requests, prioritised by an AI spoilage-risk model
- Shared-delivery suggestions that combine nearby pickups into one trip

### 7.2 Consolidation
- Cost comparison between separate trips and a combined route

### 7.3 Active route
- Stop-by-stop progress with status updates that notify the buyer

### 7.4 Earnings
- Same wallet system as the farmer workspace

---

## 8. Admin console

- Platform-wide metrics: user counts, GMV, post-harvest loss reduction
- Items needing attention: disputes, unverified farmers, pending payouts
- USSD/SMS channel activity
- User, listing, and logistics management tables

---

## 9. Architecture summary

- **Frontend** — responsive web app (this walkthrough)
- **Backend** — Node.js + Express API
- **Database** — PostgreSQL + PostGIS for geolocation
- **AI service** — Python (FastAPI + scikit-learn) for price prediction,
  harvest timing, freshness scoring, and spoilage risk
- **Payments** — MTN MoMo Collection API

See `backend/README.md` for API details and local setup instructions.
