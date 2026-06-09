# Expo → bare React Native: execution plan

This is the concrete, app-specific plan for finishing the migration that the
`src/platform/` seams set up. Steps 1–6a (all the import seams) are **done** and
non-breaking. What remains — swapping seam internals, the routing-model rewrite,
and the native build — **must be run on a real dev machine** (Node + Xcode +
Android SDK + CocoaPods). It can't be built or verified in the CI sandbox, and a
half-finished routing/build change leaves the app unbuildable, so do each phase
on a branch and verify before merging.

Verify after every phase: `npx tsc --noEmit`, `npm run ios`, `npm run android`,
and the web build.

---

## Phase 7A — swap seam internals to bare-RN libraries

Each `src/platform/*` file currently re-exports an `expo-*` package. Replace the
internals **one file at a time**; call sites don't change. Suggested mappings:

| Seam (`src/platform/`) | From | To (bare RN) | Native setup |
|---|---|---|---|
| `clipboard.ts` | expo-clipboard | `@react-native-clipboard/clipboard` | pod install |
| `linear-gradient.ts` | expo-linear-gradient | `react-native-linear-gradient` | pod install |
| `status-bar.ts` | expo-status-bar | RN `StatusBar` (from `react-native`) | none |
| `linking.ts` | expo-linking | RN `Linking` + `react-native-url-polyfill` | none |
| `constants.ts` | expo-constants | `react-native-device-info` / app config | pod install |
| `device.ts` | expo-device | `react-native-device-info` | pod install |
| `secure-store.ts` | expo-secure-store | `react-native-keychain` | pod install |
| `speech.ts` | expo-speech | `react-native-tts` | pod install |
| `document-picker.ts` | expo-document-picker | `react-native-document-picker` | pod install |
| `image-picker.ts` | expo-image-picker | `react-native-image-picker` | pod install + Info.plist perms |
| `camera.ts` | expo-camera | `react-native-vision-camera` | pod install + perms + Reanimated |
| `audio.ts` | expo-audio | `react-native-video` (audio) or `react-native-track-player` | pod install |
| `video.ts` | expo-video | `react-native-video` | pod install |
| `notifications.ts` | expo-notifications | `@notifee/react-native` + `@react-native-firebase/messaging` | Firebase + pods + APNs |
| `splash-screen.ts` | expo-splash-screen | `react-native-bootsplash` | generate assets + native |
| `font.ts` | expo-font | native font linking (`react-native.config.js` assets) — the hook becomes a no-op | `npx react-native-asset` |
| `icons.ts` | @expo/vector-icons | `react-native-vector-icons` (Ionicons) | link fonts via `react-native.config.js` |

Notes:
- The API shapes differ. Where they do, the seam file absorbs the difference so
  call sites keep their current API (e.g. `setStringAsync` stays the public name
  in `clipboard.ts` even if the new lib is sync).
- `image-picker.ts` is the highest-touch (11 call sites rely on its result
  shape: `assets[].uri/base64`). Map `react-native-image-picker`'s response to
  the same fields inside the seam so nothing downstream changes.
- Permissions move from `app.json` to `Info.plist` / `AndroidManifest.xml`.

---

## Phase 7B — routing: expo-router → React Navigation

This is the rewrite the seams can't do for you. The `app/` directory + Metro
plugin (file-based routes) is replaced by an explicit navigator tree.

### Install
`@react-navigation/native @react-navigation/native-stack
@react-navigation/bottom-tabs react-native-screens react-native-safe-area-context`
(the last two are already present via Expo).

### Target structure
- **RootStack** (`native-stack`) — every screen below registered explicitly:
  - `Tabs` (the bottom-tab navigator) as the first screen.
  - All other routes as stack screens (detail/modal pages).
- **Tabs** (`bottom-tabs`) — 8 screens from `app/(tabs)/`:
  `index, feed, messages, marketplace, groups, favorites, directions, profile`
  (today driven by `app/(tabs)/_layout.tsx`).
- ~70 stack routes from the flat + dynamic files, e.g.
  `chat/[id] → Chat {id}`, `user/[name] → User {name}`,
  `post/[id]`, `listing/[id]`, `group/[id]`, `group/[id]/members`,
  `pay/[id]`, `call/[id]`, `story/[userId]`, `eta/[shareId]`,
  `f/[key]`, `g/[slug]`, `c/[name]`, `legal/[doc]`, `hashtag/[tag]`,
  `place/[id]`, `seller/[id]`, `game/[id]`, `guide/[id]`, `forms/[id]`,
  `support/[id]`, plus all the static screens (settings, wallet, money,
  admin-*, etc.).

### API mapping (the seam shrinks to React Navigation under the hood)
| expo-router (current) | React Navigation |
|---|---|
| `useRouter().push({pathname:"/chat/[id]", params:{id}})` | `navigation.navigate("Chat", {id})` |
| `useRouter().replace(...)` | `navigation.replace(...)` (native-stack) |
| `useRouter().back()` | `navigation.goBack()` |
| `useLocalSearchParams()` | `useRoute().params` |
| `usePathname()` | derive from `useNavigationState` / route name |
| `useFocusEffect` | same — re-export from `@react-navigation/native` |
| `<Redirect href=…/>` | imperative `navigation.reset(...)` in an effect |
| `<Stack.Screen options=…/>` | `navigation.setOptions(...)` or `screenOptions` |
| `<Stack>` / `<Tabs>` (`_layout`) | the navigator components above |

Keep the seam: re-point `src/platform/navigation.ts` to thin wrappers
(`useRouter` returns an object whose `.push` maps pathnames → screen names) so
the ~99 call sites still work and the change stays centralized. A pathname→
screen-name lookup table lives in the seam.

### Preserve URLs (web + deep links)
Build a React Navigation `linking` config mapping each screen to its current
path (`/chat/:id`, `/user/:name`, …) so existing links and the web routes keep
working. Add a top-level redirect for `app/index.tsx`'s entry logic.

### Typed routes
Replace expo-router's generated route types with a `RootStackParamList` /
`TabParamList` and type `navigation`/`route` against them.

---

## Phase 7C — build system

1. **Generate native projects.** Easiest: `npx expo prebuild` (keeps you on
   Expo's prebuild but gives real `ios/`/`android/`). True bare: `npx
   @react-native-community/cli init` a sibling app and move `ios/`+`android/`+
   config in. (If prebuild is acceptable, most of 7A/7B/7C is unnecessary —
   see the note at the bottom.)
2. **Entry point.** Replace `"main": "expo-router/entry"` with `index.js`:
   `AppRegistry.registerComponent(...)` rendering the RootStack +
   `NavigationContainer`.
3. **Metro/Babel.** Drop the expo-router babel plugin; keep
   `react-native-reanimated/plugin` last. Use a standard `metro.config.js`.
4. **Web.** Expo gave you web via react-native-web automatically. Bare RN needs
   it wired manually (react-native-web + a bundler, or keep Expo's web only).
   Decide if web is still a target; `app/+html.tsx` (`expo-router/html`) goes
   away here.
5. **Fonts/assets.** `react-native.config.js` with the vector-icons + any custom
   fonts; run `npx react-native-asset`.
6. **Env/config.** Replace `expo-constants` config access with
   `react-native-config` or a generated constants module.

---

## Recommended order & risk

1. 7A library swaps first, **one seam per PR**, lowest-risk first
   (status-bar, linking, clipboard) → highest (notifications, camera). Each is
   independently shippable while still on Expo.
2. 7C step 1 (generate native projects) — once, early, so 7A pods can install.
3. 7B routing last and in one focused effort — it touches navigation everywhere
   and is the hardest to do incrementally.

## Strongly consider before doing any of this

`npx expo prebuild` + a **development build** gives you real `ios/`/`android/`
projects and the ability to add **any** native module/library — while keeping
expo-router, every current library, and the web target. If the goal is "native
control / a library Expo Go blocked," that path delivers it in an afternoon and
makes Phases 7A–7C unnecessary. A full bare eject is only worth it if you have a
hard requirement to remove Expo's runtime entirely.
