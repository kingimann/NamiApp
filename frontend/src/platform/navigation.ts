/**
 * Navigation — internal seam over the router/navigation API.
 *
 * Pass-through to `expo-router` today, so behavior and expo-router's typed
 * routes are unchanged. This decouples every call site from `expo-router`
 * directly, which is the first half of the routing migration (see ./README.md).
 *
 * NOTE: this seam covers the *imperative/hook* API (useRouter, params, focus,
 * redirects) and the layout navigators (Stack/Tabs). The file-based `app/`
 * routing model itself (Metro plugin + directory convention) is replaced in the
 * separate build-system step — that part is not a one-file swap.
 */
export {
  useRouter,
  router,
  useLocalSearchParams,
  usePathname,
  useFocusEffect,
  Redirect,
  Stack,
  Tabs,
} from "expo-router";
