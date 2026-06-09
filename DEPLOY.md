# Deploying OkaySpace on Render

The backend is a **FastAPI** app that stores everything in **PostgreSQL**
(see `backend/db.py` — a Mongo-style wrapper over a JSONB table per
collection). Render hosts the API (and the web build) for free and redeploys
automatically on every push; the database is a separate **external Postgres you
control** (a free [Neon](https://neon.com) or Supabase instance works well).
Total time: ~15 minutes, mostly waiting.

> Heads up: this project no longer uses Replit or MongoDB. The Replit config
> files have been removed and the old Mongo Atlas instructions are gone — the
> only database is Postgres, configured through `DATABASE_URL`.

---

## Step 1 — Push your code to GitHub, ~3 min

If it isn't already on GitHub:
```bash
git add .
git commit -m "Deploy to Render"
git push -u origin main
```
The `render.yaml` at the repo root tells Render exactly how to deploy the API
and the web service. The database lives outside Render — see Step 2a.

---

## Step 2a — Create your Postgres (Neon), ~3 min

`render.yaml` points `DATABASE_URL` at an external Postgres (Render's own free
Postgres expires after 30 days, so the managed `databases:` block is left
commented out). Any provider works; [Neon](https://neon.com) has a free tier
that doesn't expire:

1. Sign up at https://neon.com → **Create project**.
2. Copy the **direct** (non-pooled) connection string — it looks like
   `postgresql://user:password@ep-xxx.aws.neon.tech/dbname?sslmode=require`.
   Keep the `?sslmode=require` on the end.
3. Hold onto it for Step 2 — you'll paste it as `DATABASE_URL`.

(Supabase: Project → Settings → Database → Connection string → URI, direct/
non-pooled. The tables are created automatically on first use — no migration.)

---

## Step 2 — Deploy on Render (Blueprint), ~5 min

1. Go to https://render.com and sign up with your GitHub account.
2. **New + → Blueprint**.
3. Pick your repo. Render reads `render.yaml` and shows two services:
   - `okayspace-v0vx` — the Docker web service (the API)
   - `okayspace-web` — a static site (the Expo app exported for the web)
4. It will prompt for the `sync: false` values (Render never reads these from
   git). The important ones:
   - `DATABASE_URL` (backend) → paste your external Postgres DSN from Step 2a.
     **Required** — the API has no data without it.
   - `EXPO_PUBLIC_BACKEND_URL` (web) → the API's URL. If you don't know it yet,
     it's `https://okayspace-v0vx.onrender.com` (Render names it after the
     service). You can also leave it blank now and set it after the first
     deploy, then re-deploy the static site — see the note in Step 2b.
   - `EXPO_PUBLIC_MAPBOX_TOKEN` (web) → a Mapbox **public** token (for maps).
   - `FSQ_API_KEY` and other backend keys → optional, leave blank to skip.
5. Click **Apply**. Render builds the Docker image and the web bundle, then
   deploys. Watch the API logs for `Uvicorn running`.
6. Render gives you a backend URL like `https://okayspace-v0vx.onrender.com` and a
   web URL like `https://okayspace.ca`.

### Step 2b — fix the web's backend URL (if you left it blank)

The web bundle bakes `EXPO_PUBLIC_BACKEND_URL` in at build time. If you didn't
know the API URL during the first apply, open the **okayspace-web** service →
**Environment**, set `EXPO_PUBLIC_BACKEND_URL` to the real backend URL (no
trailing slash, no `/api`), and trigger a **Manual Deploy → Clear build cache &
deploy**. The web app will then talk to your API.

> Don't want the web site? Delete the `okayspace-web` block from `render.yaml` —
> the API and database deploy fine on their own, and you ship mobile via EAS.

**Test it:** open `https://okayspace-v0vx.onrender.com/health` — you should see
`{"status":"ok"}`. The tables are created automatically on first use, so there
is no migration step.

> Free-plan note: the web service spins down after ~15 min idle, so the first
> request after a nap takes ~30s to wake. Upgrade to the $7/mo plan to keep it
> always-on. (Your database is external, so it isn't affected by Render's free
> tier — pick a provider whose free tier doesn't expire, like Neon.)

---

## Step 3 — Run / ship the app

**Hosted web:** nothing more to do — `okayspace-web` is your web app. Open its
Render URL.

**Local development:** create `frontend/.env`:
```
EXPO_PUBLIC_BACKEND_URL=https://okayspace-v0vx.onrender.com
EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_public_token
```
No trailing slash, no `/api` — the client adds that itself. (For local web dev
you can omit `EXPO_PUBLIC_BACKEND_URL` and let the Metro proxy serve `/api` on
the same origin; on a device, point it at a URL the device can reach.) Then:
```bash
cd frontend
npm install
npx expo start
```

**Mobile app (iOS/Android):** build with EAS — Render only hosts the API and the
web site, not native binaries:
```bash
cd frontend
npm install -g eas-cli
eas build -p android   # or ios
```
Set `EXPO_PUBLIC_BACKEND_URL` / `EXPO_PUBLIC_MAPBOX_TOKEN` as EAS env vars so the
build points at your Render backend.

---

## Creating your first account

The app uses plain email/password auth. Register through the sign-up screen, or
hit the API directly to confirm it works:
```bash
curl -X POST https://okayspace-v0vx.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"supersecret","name":"You","username":"you"}'
```
A successful response returns a `session_token` and your user object.

---

## Letting Render manage the database instead

The default is an external Postgres (Step 2a). If you'd rather Render host it,
**uncomment** the `databases:` block in `render.yaml` and change the backend's
`DATABASE_URL` from `sync: false` back to a `fromDatabase` reference — Render
then creates the instance and injects the connection string automatically. Note
its free Postgres expires after 30 days, so this suits short-lived demos only.

---

## Environment variables (reference)

| Variable        | Required | Purpose                                                        |
|-----------------|----------|----------------------------------------------------------------|
| `DATABASE_URL`  | yes      | External Postgres DSN (`asyncpg`). Set it in the dashboard (`sync: false`). |
| `CORS_ORIGINS`  | no       | Comma-separated allowed origins, or `*` (default).             |
| `FSQ_API_KEY`   | no       | Foursquare key for place matching. Safe to leave blank.        |
| `PORT`          | no       | Set by the host; the server binds to it (defaults to 8080).    |

No application logic depends on the host — the same image runs anywhere that
can run a Docker container and reach a Postgres database.
