# Deploying AgroLink360

## 1. Frontend — GitHub Pages (2 minutes, free)

The repo root already has an `index.html` that opens the wireframe app.

1. On GitHub, go to your repo → **Settings → Pages**.
2. Under "Build and deployment", set **Source: Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Click **Save**.
4. Wait ~1 minute, then your live URL appears at the top of that page —
   usually `https://nabonadam.github.io/AgroLink360-/`.

That's your submission's "deployed version" link for the frontend.

## 2. Backend — Render.com (free tier)

`render.yaml` at the repo root defines everything Render needs: the Node API,
the Python AI service, and a Postgres database.

1. Go to https://dashboard.render.com → **New → Blueprint**.
2. Connect your GitHub account if prompted, then pick the `AgroLink360-` repo.
3. Render reads `render.yaml` and shows 3 resources to create:
   `agrolink360-db`, `agrolink360-api`, `agrolink360-ai`. Click **Apply**.
4. Wait for all three to go green ("Live"). The API's URL will look like
   `https://agrolink360-api.onrender.com`.
5. **One manual step:** Render's free Postgres does not have PostGIS
   pre-installed. Open the `agrolink360-db` database's **Shell** tab in the
   Render dashboard and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
   Then redeploy `agrolink360-api` (or it will fail migration on first boot —
   just click **Manual Deploy → Deploy latest commit** again after adding the
   extensions).
6. Once live, seed demo data once via the Shell tab on `agrolink360-api`:
   ```
   npm run seed
   ```

Free-tier services sleep after 15 minutes of inactivity and take ~30s to wake
on the next request — expected for a hackathon demo, not a problem.

## 3. Connect the frontend to the live backend

The wireframe currently simulates data locally. To point the real app at the
live API, edit the `API` constant at the top of `backend/client-example.js`
to your Render URL, e.g.:

```js
const API = 'https://agrolink360-api.onrender.com/api';
```

For the hackathon demo itself, the wireframe alone (step 1) is enough to show
the UI/UX live — the backend link demonstrates the working API separately
(e.g. hitting `https://agrolink360-api.onrender.com/health` in a browser).
