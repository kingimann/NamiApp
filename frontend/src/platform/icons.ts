/**
 * Icons — internal seam over the app's icon set.
 *
 * Pass-through to `@expo/vector-icons` today; the eventual bare-RN swap
 * (`react-native-vector-icons`, which @expo/vector-icons already wraps) happens
 * here. Part of the gradual move off Expo (see ./README.md).
 *
 * The app uses Ionicons everywhere. Re-exporting the component also re-exports
 * its prop/type info, so `import type { Ionicons }` keeps working. If another
 * family is ever needed, add it to this one file.
 */
export { Ionicons } from "@expo/vector-icons";
