# AgroLink360 — Complete App Walkthrough

**Agro AI Nexus · GDSS-PSInno Agritech Innovation Challenge · July 2026**

A guided tour of every screen and interaction in the AgroLink360 wireframe
(`AgroLink360 Wireframe (Standalone).html`). Use this as your presentation
script — the flows are listed in the order that tells the strongest story.

---

## 1. What you're looking at

AgroLink360 is an AI-powered farmer-to-buyer marketplace with smart logistics
for Ghana's vegetable value chain (Ashanti Region pilot: Ejisu, Akomadan,
Offinso → Kumasi). The wireframe is one responsive web app:

- **Desktop** — top bar + sidebar layout (what you'll present on a projector)
- **Mobile** — same file; below 820px the sidebar becomes a bottom tab bar
- **Everything clickable** — hovering shows a green outline; buttons navigate,
  forms accept input, modals and toasts respond

The app has **3 zones**: the public landing page, the auth flow
(signup/login), and the logged-in workspace with 4 roles — **Farmer, Buyer,
Transport, Admin** (switchable via the tabs in the top bar).

---

## 2. Landing page (start here)

The app opens on the marketing site — what a farmer or buyer first sees.

| Section | What it shows | What's clickable |
|---|---|---|
| Header | Logo, nav, **Log in** / **Get started** | nav anchors scroll; buttons open auth |
| Hero | "From farm gate to buyer's door — one tap" + pilot stats (1,284 farmers, GH₵ 212k June GMV, −31% post-harvest loss) | **Get started free** → signup · **See how it works** → scrolls |
| How it works | 4 steps: List produce → AI matches → Track delivery → Get paid | — |
| Who it's for | Farmer / Buyer / Transporter cards | **Join as…** jumps straight to signup step 2 with that role pre-selected |
| AI engine | Price prediction, demand forecasting, spoilage alerts, shared routes | — |
| USSD banner | "No smartphone? No internet? No problem" — **\*920\*36#**, Twi/Dagbani/Hausa | — |
| Footer | Brand blurb · Platform links · Contact · Offline access · copyright bar | anchor links |

> **Talking point:** the USSD banner is the inclusion story — the same
> marketplace works on a GH₵ 100 feature phone.

## 3. Sign up (3 steps)

1. **Pick a role** — Farmer / Buyer / Transporter cards
2. **Details** — name, phone (+233), community, 4-digit PIN.
   *Validates: every field required; toast prompts if missing.*
3. **Verify** — SMS OTP screen (demo accepts any code)

On verify you land in the right workspace, greeted by name — the dashboard
header reads "Akwaaba, {your name}" and shows your community.

> **Design decisions to call out:** phone-first (no email — the phone number
> *is* the MoMo account), PIN not password (USSD-compatible), community field
> feeds the logistics grouping.

## 4. Log in

Phone + PIN, plus a role chip (Farmer / Buyer / Transporter / Admin) so you
can demo any workspace quickly. Demo mode accepts any phone + PIN.
**Log out** (top right in the app) returns to the landing page.

---

## 5. Farmer workspace 🌱

*(Log in as Farmer, or role-tab → Farmer)*

### 5.1 Dashboard
- **Greeting** — personalized after signup
- **KPI row** — 12 listings · 5 pending orders · GH₵ 8,420 June revenue ·
  2 spoilage alerts ⚠ (each KPI clicks through to its page)
- **Revenue chart** — 6-month bars, June highlighted, +18%
- **AI Harvest Assistant** — the flagship AI card: *"Tomatoes — best selling
  window Jul 8–15 · est. 32 crates · proj. GH₵ 165/crate · 86% confidence"*
- **Recent orders** — status tags (in transit / confirmed / awaiting pickup);
  in-transit rows open live tracking

### 5.2 My Produce
- 6 listing cards with photo placeholder, quantity, price, and an
  **AI freshness bar** (green ≥75%, amber below)
- Onion shows the **spoilage-risk** state (67%, amber) — the AI alert story
- **+ New listing** opens the listing modal: photo, produce, qty/unit, price —
  with an **AI price suggestion** ("AI suggests GH₵ 140 — market average this
  week"). Publish → toast confirms.

### 5.3 Orders
- Open/Completed filter chips; rows show buyer, produce, value, status
- "Needs transport" row → **request transport** sends the job to drivers

### 5.4 Wallet
- Black MoMo card — GH₵ 8,420 balance, Withdraw / Cash out
- Transaction list (+payments in green, −withdrawals/fees)
- Escrow note: *funds held until delivery confirmed* — the trust mechanism

---

## 6. Buyer workspace 🛒 (the money demo — do this one live)

*(Role-tab → Buyer)*

### 6.1 Marketplace
- Produce cards ranked by **AI freshness + distance** (PostGIS in the real build)
- Each card: freshness %, farmer name, community, distance, rating, price
- Search bar + category chips (chips actively filter)

### 6.2 Product page → checkout *(click any card)*
- Photo gallery, farmer info, rating
- **AI line:** "92% fresh · harvested yesterday · price 5% below market average"
- Quantity stepper (− / +) with **live total** = produce + GH₵ 95 delivery

### 6.3 Pay with MoMo *(click "Pay with MoMo →")*
- MTN MoMo sheet: amount, **escrow explanation**, PIN field
- **Confirm payment** → toast "Payment simulated ✓ — order #AL-2381 placed"
  → lands directly on…

### 6.4 Live tracking
- Map placeholder (Ejisu → Kumasi route, live GPS pin)
- **ETA 24 min · on time** · driver card (Kofi Asante, tricycle GR 4821-22,
  call button) · journey timeline: confirmed → picked up → **in transit** → delivered

### 6.5 My orders
- In-transit order → tracking · delivered order → **rate ★** (star modal,
  tap stars to cycle rating) · past order → **reorder ↻**

> **The 60-second story:** marketplace → tap tomatoes → set 8 crates → pay
> with MoMo → watch it tracked live. Farm to buyer in four taps.

---

## 7. Transport workspace 🛺

*(Role-tab → Transport)*

### 7.1 Requests
- **AI shared-delivery banner** (amber): *"combine 3 Ejisu-corridor pickups —
  save GH₵ 70 fuel · 2 fewer trips"* → opens consolidation
- Request cards: route, load, distance, payout, **priority tag from the AI
  spoilage model** (tomatoes = high, onions = medium)
- Tapping a request accepts it → toast + jumps to the route board

### 7.2 Consolidation
- 3 pickups listed as route stops + the economics: ~~GH₵ 255 solo~~ →
  **GH₵ 185 shared**, 84% load, 2 fewer trips
- **Accept shared route →** the platform's efficiency + climate story

### 7.3 Active route
- Stop list A → 1 → 2 → B with done/next states, navigate button
- **Mark stop done** → toast: *"buyer gets SMS + push update"* — shows how
  driver actions feed buyer tracking

### 7.4 Earnings
- Same wallet as farmer — drivers are paid through the same MoMo rails

---

## 8. Admin console 🖥

*(Role-tab → Admin — desktop-first, for the ops team)*

- **Overview** — platform KPIs (1,284 farmers · 312 buyers · 86 transporters ·
  GH₵ 212k GMV · **−31% post-harvest loss**), weekly transaction chart,
  **Needs attention** queue (disputes, unverified farmers, MoMo payout queue),
  and the **USSD/SMS channel monitor** (438 sessions today, 1,902 SMS sent)
- **Users / Listings / Logistics** — searchable tables with status tags
  (verified/unverified, spoilage risk, needs driver)

---

## 9. Under the hood (when they ask "is this real?")

The wireframe mirrors a working backend already in the repo (`backend/`):

- **Node.js + Express API** — auth (JWT, role guards), marketplace, transactional
  orders, logistics, payments
- **PostgreSQL + PostGIS** — geolocation schema; marketplace distance ranking
- **Python FastAPI AI service** — price prediction, harvest window, freshness,
  spoilage risk (scikit-learn baselines, XGBoost upgrade path marked)
- **MTN MoMo Collection API** wrapper — sandbox-simulated, production-stubbed
- One command: `cd backend && docker compose up`

Every screen element is mapped to its endpoint in
**AgroLink360 Integration Guide** (in this project) — the dev handoff doc.

## 10. Suggested 5-minute demo script

| Min | Do | Say |
|---|---|---|
| 0–1 | Landing page, scroll hero → USSD banner | The problem: middlemen, spoilage, no market access. Works on any phone. |
| 1–2 | Sign up as a farmer (real name) | Phone-first, PIN, SMS verify — built for rural reality. "Akwaaba, {name}" |
| 2–3 | Farmer dashboard → harvest AI card → list produce with AI price hint | AI tells farmers *when* to sell and *what price* to ask. |
| 3–4 | Switch to Buyer → marketplace → order 8 crates → MoMo pay → live tracking | Four taps from farm gate to tracked delivery. Escrow = trust. |
| 4–5 | Switch to Transport → consolidation → accept · flash Admin overview | AI packs 3 pickups into 1 trip: cheaper, greener, less spoilage. −31% loss. |

*Resize the window (or open on a phone) at any point to show responsiveness.*
