import { Alert, Platform } from "react-native";

type AlertButton = { text?: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" };

/**
 * React Native Web's `Alert.alert` shows the message but IGNORES the buttons —
 * so every confirmation across the app (Cancel / Delete, "Are you sure?", etc.)
 * silently does nothing on web, and destructive/confirm callbacks never fire.
 *
 * This patches `Alert.alert` (web only) to drive the browser's native
 * `window.confirm` / `window.alert` and invoke the matching button's `onPress`,
 * so all existing `Alert.alert(...)` call sites work on web without changes.
 *
 * Call once at app startup, before anything renders.
 */
export function installWebAlertShim() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;

  (Alert as any).alert = (
    title?: string,
    message?: string,
    buttons?: AlertButton[],
    _options?: unknown,
  ) => {
    const text = [title, message].filter(Boolean).join("\n\n");

    // 0–1 buttons → a plain notice. Show it, then run the (single) action.
    if (!buttons || buttons.length <= 1) {
      try { window.alert(text); } catch {}
      buttons?.[0]?.onPress?.();
      return;
    }

    // 2+ buttons → a confirm. The "cancel"-styled button (or the first) is the
    // cancel path; the last non-cancel button is the confirm/primary action.
    const cancelBtn = buttons.find((b) => b.style === "cancel") || buttons[0];
    const confirmBtn =
      [...buttons].reverse().find((b) => b !== cancelBtn) || buttons[buttons.length - 1];

    let ok = false;
    try { ok = window.confirm(text); } catch { ok = true; }
    (ok ? confirmBtn : cancelBtn)?.onPress?.();
  };
}
