# Atlas Maps (Nampo)

A dark-themed, full-stack maps + social application. It pairs Apple-/Google-Maps-style
navigation (Mapbox-powered) with a Twitter/Instagram-style social layer — posts, stories,
reels, groups, messaging, and a local marketplace — on top of a single FastAPI backend.

The mobile/web client is built with **Expo (React Native + expo-router)** and the API is a
**FastAPI** service backed by **PostgreSQL** (through a Mongo-style query wrapper).

> **Naming note:** the project is referred to as both **"Atlas Maps"** (the Expo app name,
> the API root response, and `memory/PRD.md`) and **"Nampo"** (the repo/deploy artifacts and
> `render.yaml`'s `nampo-backend` service). They are the same project.

---

## Table of contents

- [Architecture](#architecture)
- [Feature surface](#feature-surface)
- [Repository layout](#repository-layout)
- [Backend](#backend)
  - [Data layer](#data-layer)
  - [Auth](#auth)
  - [Environment variables](#backend-environment-variables)
  - [Running locally](#running-the-backend-locally)
- [Frontend](#frontend)
  - [Environment variables](#frontend-environment-variables)
  - [Running locally](#running-the-frontend-locally)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Known gaps & caveats](#known-gaps--caveats)

---

## Architecture

```
┌─────────────────────────────┐         HTTPS / WSS          ┌──────────────────────────┐
│  Expo client                │  ───────────────────────▶   │  FastAPI backend         │
│  (iOS / Android / Web)       │   /api/...  +  /api/ws/eta   │  server.py               │
│                              │  ◀───────────────────────   │                          │
│  expo-router screens         │                              │  routes/*  (13 modules)  │
│  src/api/client.ts (REST)    │                              │  services/* (enc, links) │
│  MapboxWebView (WebView GL)  │                              │  core.py  (auth, deps)   │
└──────────────┬──────────────┘                              │  db.py  (Mongo→Postgres) │
               │                                               └────────────┬─────────────┘
               │ direct calls                                              │ asyncpg pool
               ▼                                                            ▼
   Mapbox APIs (geocode, GL JS,                                     PostgreSQL
   directions, tiles, styles)                                 (JSONB "doc"-per-row tables)
```

Key design points:

- **One FastAPI app** mounts all routers under the `/api` prefix and exposes `/` and
  `/health` for platform health checks. A single WebSocket route (`/api/ws/eta/{share_id}`)
  powers live ETA sharing.
- **The web client uses relative URLs** (`""` base) so a same-origin server or a dev proxy
  handles routing and CORS is sidestepped. Native builds use the full
  `EXPO_PUBLIC_BACKEND_URL` and derive `wss://` from it automatically.
- **Mapbox runs inside a WebView** (`MapboxWebView.tsx` injects Mapbox GL JS), so the same
  map code works on native and web without a native Mapbox SDK build.

---

## Feature surface

**Maps & navigation**
- Four Mapbox styles (streets, satellite-streets, dark, outdoors), traffic overlay, 3D
  buildings, compass reset.
- Search with category quick-filters plus saved Home/Work shortcut chips.
- Per-user Recents (capped list).
- Multi-stop directions (drive / walk / cycle) with turn-by-turn steps.
- Voice navigation via `expo-speech` with a mute toggle.
- Live ETA sharing over WebSocket; the public `/eta/{id}` viewer needs no account.

**Place cards & reviews**
- Distance, ratings, reviews, plus Directions / Save / Share / Open-in-Maps actions.
- Five-star write-a-review modal with a race-safe upsert.
- Optional Foursquare business-profile enrichment (requires an API key).

**Library**
- Saved Places and Guides. Each guide has a color, an icon, a public toggle, and a unique
  slug. Public guides are viewable at `/g/{slug}` and can be cloned into your own library.

**Social layer**
- **Posts / feed:** text, media (images/video), polls, link previews, hashtags, replies,
  reposts, quote-reposts, likes, bookmarks, and view counts. Home and Explore feeds.
- **Stories:** 24h ephemeral image/video stories with a tray, view counts, viewer lists,
  and direct replies.
- **Reels:** a video-only feed.
- **Groups:** public/private groups with owners/admins/members, join requests, promotions,
  pinned posts, and group-only post feeds.
- **Messaging:** 1:1 and group conversations, text + shared-place + media bubbles, unread
  badges, read receipts, delete-own-message, and (optional) message encryption at rest.
- **Connections:** follow/unfollow plus a bidirectional friend-request system.
- **Notifications:** likes, reposts, replies, messages, and group activity.
- **Marketplace:** local listings with photos, price/currency, categories, and a
  "contact seller" action that opens a conversation.

---

## Repository layout

```
.
├── README.md            ← this file
├── DEPLOY.md            ← step-by-step hosted-deploy walkthrough
├── REPLIT.md            ← Replit-specific notes
├── render.yaml          ← Render Blueprint (deploys the backend)
├── replit.nix           ← Replit environment
├── design_guidelines.json
├── memory/PRD.md        ← product requirements / feature log
├── test_result.md       ← test iteration log
│
├── backend/
│   ├── server.py        ← FastAPI app, router mounting, WebSocket, startup
│   ├── core.py          ← shared deps: DB proxy, auth, helpers (slugs, users)
│   ├── db.py            ← Mongo-compatible async wrapper over PostgreSQL (asyncpg)
│   ├── models.py        ← all Pydantic models
│   ├── requirements.txt
│   ├── Dockerfile       ← container build (uvicorn server:app)
│   ├── apprunner.yaml   ← optional AWS App Runner config
│   ├── routes/          ← 13 route modules (see API reference)
│   ├── services/        ← encryption.py (Fernet), link_preview.py (OpenGraph)
│   └── tests/           ← pytest suites (343 test functions across iterations)
│
└── frontend/
    ├── app/             ← expo-router screens (tabs + stacks + dynamic routes)
    ├── src/
    │   ├── api/client.ts   ← typed REST client + shared TS types
    │   ├── api/mapbox.ts    ← Mapbox geocode/directions helpers
    │   ├── components/      ← PostCard, StoryTray, MapboxWebView, etc.
    │   ├── context/         ← Auth / NavBar / Sidebar React contexts
    │   ├── hooks/, utils/   ← icon fonts, storage, E2E key helpers
    │   └── theme.ts         ← colors + Mapbox style URLs
    ├── constants/, scripts/, assets/
    ├── app.json, package.json, tsconfig.json, metro.config.js, eslint.config.js
```

---

## Backend

### Data layer

`db.py` is the interesting piece: it exposes a **Motor/PyMongo-style async API**
(`find_one`, `find().sort().limit().to_list()`, `insert_one`, `update_one` with `$set`/`$inc`,
`delete_many`, `count_documents`, etc.) but stores everything in **PostgreSQL**. Each
"collection" is a table with a single `jsonb` `doc` column; Mongo update operators are
applied in Python and written back as a JSONB update. This lets route code read like Mongo
while running on Postgres.

`core.py` provides a lazy `db` proxy (the real connection pool is created during FastAPI
startup via `init_pool()`), the `get_current_user` bearer-token dependency, slug generation,
and the public-user/stats builder.

Collections in use: `users`, `user_sessions` (TTL), `places`, `recents`, `guides`,
`reviews`, `conversations`, `messages`, `eta_shares` (TTL), `posts`, `stories`, `groups`,
`follows`, `friendships`, `friend_requests`, `notifications`, `listings`, and an
`oauth_states` table auto-provisioned for Google sign-in CSRF state.

### Auth

- **Primary:** email/password with bcrypt. Register, login, logout, username
  availability/claim, and `PATCH /auth/me` for profile (name, bio, picture, Home/Work).
- **Optional:** Google OAuth (`/auth/google/login` → `/auth/google/callback`), gated on
  `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`.
- **Sessions:** opaque bearer `session_token` stored in `user_sessions` with expiry; sent as
  `Authorization: Bearer <token>`.
- **Optional E2E messaging keys:** clients can upload a public key
  (`POST /auth/keys`) and fetch peers' keys; `services/encryption.py` (Fernet) encrypts
  message bodies at rest when `MESSAGE_ENC_KEY` is set, transparently passing through
  plaintext when it isn't.

### Backend environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL DSN. The app reads this at startup (`init_pool`). |
| `CORS_ORIGINS` | No | Comma-separated allowed origins, or `*` (default). |
| `FSQ_API_KEY` | No | Foursquare key for place-profile matching. Disabled if blank. |
| `MESSAGE_ENC_KEY` | No | Fernet key to encrypt messages at rest. Plaintext if unset. |
| `GOOGLE_OAUTH_CLIENT_ID` / `..._SECRET` | No | Enables Google sign-in. |
| `PORT` | No | Server port (defaults to 8080; platforms inject this). |

> **Config mismatch to be aware of:** `DEPLOY.md` and `render.yaml` still reference
> `MONGO_URL` / `DB_NAME` from an earlier MongoDB iteration, but the current code reads
> **`DATABASE_URL`** and talks to PostgreSQL via `asyncpg`. When deploying, set
> `DATABASE_URL` to your Postgres connection string regardless of what the older docs say.

### Running the backend locally

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

export DATABASE_URL="postgresql://user:password@localhost:5432/atlas"
export CORS_ORIGINS="*"
# optional: FSQ_API_KEY, MESSAGE_ENC_KEY, GOOGLE_OAUTH_CLIENT_ID/SECRET

uvicorn server:app --host 0.0.0.0 --port 8080 --reload
```

Health check: `GET http://localhost:8080/health` → `{"status":"ok"}`.
Root: `GET /` → `{"status":"ok","app":"Atlas Maps API"}`.

---

## Frontend

Expo SDK 54, React 19, React Native 0.81, expo-router 6 (typed routes). Routing lives in
`app/`: a `(tabs)` group (map, directions, favorites, feed, marketplace, groups, messages,
profile) plus stack screens and dynamic routes such as `post/[id]`, `user/[name]`,
`group/[id]`, `chat/[id]`, `story/[userId]`, `g/[slug]`, `hashtag/[tag]`, and `eta/[shareId]`.

The map is rendered by `src/components/MapboxWebView.tsx`, which builds an HTML page that
loads Mapbox GL JS and is displayed via `react-native-webview` — the same code path on
native and web.

### Frontend environment variables

Create `frontend/.env` (Expo exposes `EXPO_PUBLIC_*` vars to the client):

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_MAPBOX_TOKEN` | **Yes** | Mapbox access token (maps, geocoding, directions). |
| `EXPO_PUBLIC_BACKEND_URL` | Native only | Full backend URL, e.g. `https://your-api.example.com` — no trailing slash, no `/api`. Web uses relative paths and ignores this. |

### Running the frontend locally

```bash
cd frontend
yarn            # or: npm install
# create .env with the two vars above
npx expo start  # then press w (web), i (iOS), or a (Android)
```

---

## API reference

All routes are mounted under `/api`. Grouped by module:

**auth** — `GET /` · Google `GET /auth/google/login`, `GET /auth/google/callback` ·
`GET/PATCH /auth/me` · `POST /auth/logout` · `POST /auth/register` · `POST /auth/login` ·
`GET /auth/username-available` · `POST /auth/username` · `GET /users/by-username/{username}` ·
`POST /auth/keys` · `GET /users/{user_id}/key`

**users** — `GET /users/search` · `GET /users/{id}/public` · `POST /users/{id}/follow` ·
`GET /users/{id}/followers|following` · friend flow:
`POST /friends/request/{id}`, `POST /friends/accept/{id}`, `POST /friends/reject/{id}`,
`DELETE /friends/{id}`, `DELETE /friends/request/{id}`, `GET /friends`, `GET /friends/requests`

**places** — `GET/POST /places` · `GET/DELETE /places/{id}` ·
`GET/POST /recents` · `DELETE /recents/{id}` · `DELETE /recents`

**guides** — `GET/POST /guides` · `PATCH/DELETE /guides/{id}` ·
`POST/DELETE /guides/{id}/places/{place_id}` ·
`GET /public/guides/{slug}` · `POST /public/guides/{slug}/clone`

**reviews** — `GET /reviews` · `POST /reviews` (upsert) · `DELETE /reviews/{id}`

**messaging** — `POST /conversations` · `POST /conversations/groups` ·
`PATCH /conversations/{id}` · `POST /conversations/{id}/leave` · `GET /conversations` ·
`GET/POST /conversations/{id}/messages` · `POST /conversations/{id}/read` ·
`DELETE /conversations/{id}/messages/{msg_id}` · `DELETE /conversations/{id}`

**notifications** — `GET /notifications` · `GET /notifications/unread` ·
`POST /notifications/{id}/read` · `POST /notifications/read-all` · `DELETE /notifications/{id}`

**eta** — `POST /eta` · `POST /eta/{share_id}/update` · `POST /eta/{share_id}/stop` ·
`GET /public/eta/{share_id}` · WebSocket `GET /api/ws/eta/{share_id}`

**posts** — `POST /posts` · `PATCH/DELETE/GET /posts/{id}` · `GET /posts/{id}/replies` ·
`GET /feed/explore|home|reels` · `GET /posts/user/{id}` and `/posts/user/{id}/all` ·
`POST /posts/{id}/like|repost|bookmark|vote|view` · `GET /bookmarks` ·
`GET /hashtags/{tag}` and `/hashtags/{tag}/count` ·
`GET /posts/{id}/likers|reposters`

**stories** — `POST /stories` · `GET /stories/tray` · `GET /stories/user/{id}` ·
`POST /stories/{id}/view` · `GET /stories/{id}/viewers` · `DELETE /stories/{id}` ·
`POST /stories/{id}/reply`

**groups** — `GET/POST /groups` · `GET/PATCH/DELETE /groups/{id}` ·
pins: `POST/DELETE /groups/{id}/pins/{post_id}`, `GET /groups/{id}/pins` ·
membership: `POST /groups/{id}/join|leave`,
`POST /groups/{id}/members/{id}/promote|demote`, `DELETE /groups/{id}/members/{id}` ·
requests: `GET /groups/{id}/requests`, `POST .../approve|reject` ·
posts: `GET/POST /groups/{id}/posts` · `GET /groups/{id}/members`

**marketplace** — `GET/POST /listings` · `GET /listings/user/{id}` ·
`GET/PATCH/DELETE /listings/{id}` · `POST /listings/{id}/contact`

**foursquare** — `GET /foursquare/match`

Interactive docs are available at `/docs` (Swagger) and `/redoc` when the server is running.

---

## Testing

Backend tests use pytest and live in `backend/tests/`, organized as numbered iteration
suites (ETA/races, local auth, polish/coverage, groups, group admin actions, the core
map-app surface, etc.) — **343 test functions** in total. `conftest.py` holds shared fixtures.

```bash
cd backend
pip install pytest pytest-asyncio   # if not already installed
pytest
```

---

## Deployment

Two paths ship in the repo (see `DEPLOY.md` for the full walkthrough):

1. **Render Blueprint** (`render.yaml`) — builds `backend/Dockerfile` as a Docker web
   service named `nampo-backend`, with `/health` as the health check and secrets prompted in
   the dashboard. **Remember to provide `DATABASE_URL`** (the blueprint's older `MONGO_URL`
   entry predates the Postgres migration).
2. **Docker / AWS App Runner** — the `Dockerfile` runs `uvicorn server:app` on `$PORT`
   (default 8080); `apprunner.yaml` is included for source-based App Runner deploys.

After the backend is live, point the client at it by setting `EXPO_PUBLIC_BACKEND_URL` in
`frontend/.env`, then build/run with Expo.

> On free hosting tiers the API may sleep after idle and take ~30s to wake on the first
> request — fine for development, upgrade for always-on.

---

## Known gaps & caveats

- **MongoDB → PostgreSQL transition is mid-flight in the docs.** Code uses `DATABASE_URL`
  + asyncpg, but `DEPLOY.md`/`render.yaml` and `memory/PRD.md` still mention Mongo. Trust the
  code: set `DATABASE_URL`.
- **Not shipped (need paid/native dependencies):** offline maps (require a native dev
  build), full Foursquare business profiles (need your API key), Street View, GTFS transit,
  and live traffic incidents.
- **Foursquare and Google OAuth are optional** and silently disabled without their keys.
- **Message encryption** falls back to plaintext (with a logged warning) if
  `MESSAGE_ENC_KEY` is missing or invalid.
