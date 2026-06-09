# Expo → web-native stack: execution plan

**Target: web only** (no iOS/Android release). So the native eject is out of
scope — the only Expo pieces that touch a web build are **expo-router** and
**Expo's Metro web bundler**. This plan moves the app to a **web-native stack:**

> **Vite + `react-native-web` + `react-router-dom`**

`react-native-web` keeps every existing RN component (`View`, `Text`,
`StyleSheet`, `Pressable`, …) working unchanged — we are **not** rewriting the UI
into HTML. The migration is two swaps (bundler + router) plus giving each
native-feature seam a browser implementation.

## Status (done, non-breaking)

Steps 1–6a are merged: all `expo-*`/`@expo/*` usage in `app/`+`src/` is behind
`src/platform/*` seams. The only direct Expo references left are build-level:
`expo-router/entry` (package.json `main`) and `expo-router/html` (`+html.tsx`).

## Can't be verified in the CI sandbox

No `node_modules`, no dev server. The bundler/router swap is a **breaking
structural change** (not a pass-through), so it must be built and run locally
(`vite dev`, then `vite build`) and verified screen-by-screen before merge.

---

## Phase W1 — bundler: Expo/Metro-web → Vite

1. Add deps: `vite @vitejs/plugin-react react-native-web`
   (+ `vite-plugin-commonjs` and `@babel/*` as needed for RN deps that ship
   untranspiled Flow/JSX).
2. `index.html` at project root with `<div id="root">` and
   `<script type="module" src="/src/main.tsx">`.
3. New entry `src/main.tsx`: `createRoot(...).render(<App/>)` — replaces
   `expo-router/entry`. Remove `"main": "expo-router/entry"` from package.json.
4. `vite.config.ts`:
   - `resolve.alias`: `"react-native" → "react-native-web"`; keep the existing
     `@/*` path alias (mirror `tsconfig.json`).
   - `resolve.extensions`: put `.web.tsx/.web.ts` first so platform files win.
   - `define`: `__DEV__`, `process.env` shims, `global → window`.
   - `optimizeDeps`/`commonjs` for RN-flavored deps that aren't ESM.
5. Asset handling: fonts (vector-icons `.ttf`) imported/served by Vite; images
   already go through `require`/`Image` which RNW maps to `<img>`.
6. Keep `tsconfig` paths in sync. Web build output → static host (the backend
   already serves a SPA / or deploy to any static host).

Deliverable: `vite dev` renders the app through react-native-web.

---

## Phase W2 — router: expo-router → react-router-dom

The 99 navigation call sites already go through `src/platform/navigation.ts`, so
this is mostly **one file** plus a route table.

1. Add `react-router-dom`.
2. **Route table** — map every `app/**` screen file to a path and lazy-import the
   existing component (the screens themselves barely change):
   - `app/(tabs)/_layout.tsx` → a `<TabsLayout>` shell with `<Outlet/>`; its 8
     children become index routes: `/, /feed, /messages, /marketplace, /groups,
     /favorites, /directions, /profile`.
   - dynamic files → path params: `chat/[id]` → `/chat/:id`,
     `user/[name]` → `/user/:name`, `group/[id]/members` → `/group/:id/members`,
     `legal/[doc]`, `eta/[shareId]`, `f/[key]`, `g/[slug]`, `c/[name]`,
     `hashtag/[tag]`, `pay/[id]`, `call/[id]`, `story/[userId]`, etc.
   - flat files → their path (`/settings`, `/wallet`, `/admin-users`, …).
   - `app/_layout.tsx` providers (Auth, theme, nav contexts) wrap the
     `<RouterProvider>`.
3. **Reimplement the navigation seam** (`src/platform/navigation.ts`) on react-
   router so the call sites are unchanged:
   | seam export | react-router impl |
   |---|---|
   | `useRouter().push({pathname,params})` | `useNavigate()` + a pathname builder that fills `:params` |
   | `.replace(...)` | `navigate(to, {replace:true})` |
   | `.back()` | `navigate(-1)` |
   | `useLocalSearchParams()` | `{...useParams(), ...Object.fromEntries(useSearchParams()[0])}` |
   | `usePathname()` | `useLocation().pathname` |
   | `useFocusEffect` | run effect on mount + on `useLocation()` change |
   | `<Redirect href/>` | `<Navigate to/>` |
   | `<Stack>` / `<Tabs>` | replaced by the route table / `<TabsLayout>` |
   Keep `<Stack.Screen options>` semantics by setting document title / a header
   context in each screen (or drop — web doesn't need native headers).
4. Pathnames are already expo-router-style strings; a small `[param]→:param`
   builder lets `router.push({pathname:"/chat/[id]", params:{id}})` keep working,
   so most call sites need **zero changes**.
5. URLs are preserved 1:1, so existing links/bookmarks/deep links still resolve.

Deliverable: navigation works on react-router with the same URLs; `expo-router`
removed from `app/`+`src/`.

---

## Phase W3 — native-feature seams → browser APIs

Give each seam a web implementation (a `.web.ts` file, or just swap the internals
since we're web-only). Call sites don't change.

| seam | browser implementation |
|---|---|
| `clipboard` | `navigator.clipboard.writeText/readText` |
| `linking` | `window.open` / `window.location` |
| `secure-store` | `localStorage` (or IndexedDB for larger blobs) |
| `image-picker` | hidden `<input type="file" accept="image/*">` → File → dataURL |
| `document-picker` | `<input type="file">` |
| `camera` | `navigator.mediaDevices.getUserMedia` + `<video>` |
| `audio` | `<audio>` / Web Audio API |
| `video` | `<video>` |
| `notifications` | Web Notifications API + service-worker push (optional) |
| `speech` | `window.speechSynthesis` |
| `device`/`constants` | `navigator.userAgent`, a generated build-config module |
| `linear-gradient` | RNW supports CSS gradients; or a small styled wrapper |
| `status-bar`/`splash-screen`/`font` | no-ops on web (font via CSS `@font-face`) |
| `icons` | `react-native-vector-icons` web fonts, or keep `@expo/vector-icons` (it works under RNW without the Expo runtime) |

Note: several Expo packages already have web implementations; under Vite without
the Expo runtime, prefer the plain browser API in the seam so there's no Expo
dependency left.

---

## Phase W4 — cleanup

- Remove `expo`, `expo-router`, and the per-feature `expo-*` packages from
  package.json once every seam is off them.
- Delete `app/+html.tsx` (`expo-router/html`); its `<head>`/reset moves into
  `index.html`.
- Remove `app.json` / Expo config, `expo` scripts; replace with `vite dev` /
  `vite build` / `vite preview`.
- Drop the `expo-router` babel plugin; Vite uses `@vitejs/plugin-react`.
- `use-icon-fonts.ts` (Expo-Go CDN font loader) → a CSS `@font-face` block.

---

## Order, risk, verification

1. **W1 first** behind a flag/secondary entry so the app still builds on Expo
   until Vite renders. Verify `vite dev`.
2. **W2** next — the riskiest (touches routing everywhere); do it in one focused
   pass, verify each route loads and URLs match.
3. **W3** per-seam, lowest-risk first (clipboard, speech) → highest (camera,
   notifications).
4. **W4** cleanup once nothing imports Expo.

Verify after each: `npx tsc --noEmit`, `vite build`, and click through the main
flows (feed, chat, marketplace, profile, a dynamic route like `/chat/:id`).

Effort: realistically a few focused days on a real machine — W2 (router) and the
camera/notifications web seams are the bulk of it.
