import React, { useEffect, useRef, useState } from "react";
import { View, Text, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

/**
 * Web-only pull-to-refresh that RELOADS the app.
 *
 * The installed PWA disables the browser's native pull-to-refresh (the app locks
 * the viewport), so there's no way to fetch a new deploy from the home-screen
 * app. Dragging down from ANYWHERE on the screen — as long as the content under
 * your finger is scrolled to the top — reloads the page to get the latest
 * version, exactly like a normal scrolling page (no longer limited to the top
 * strip). Mostly-horizontal swipes are ignored so carousels/tabs still work.
 */
export default function WebPullToRefresh() {
  const [pull, setPull] = useState(0);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const active = useRef(false);
  const THRESHOLD = 90;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    // True when the scroll container under the finger is already at the top, so a
    // downward pull is an overscroll (refresh intent) rather than normal scroll.
    const atScrollTop = (el: any): boolean => {
      let n = el;
      while (n && n !== document.body && n !== document.documentElement) {
        try {
          const oy = getComputedStyle(n).overflowY;
          if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 2) {
            return (n.scrollTop || 0) <= 0;
          }
        } catch {}
        n = n.parentElement;
      }
      return true;
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      // Engage whenever the scroll container under the finger is at the very top,
      // regardless of WHERE on the screen the drag starts. A downward drag is
      // then a pull-to-refresh, just like a normal scrolling page — this is what
      // lets you pull from the lower part of the screen, not only the top strip.
      if (atScrollTop(e.target as any)) {
        startY.current = t?.clientY ?? 0;
        startX.current = t?.clientX ?? 0;
        active.current = true;
      } else { active.current = false; startY.current = null; }
    };
    const onMove = (e: TouchEvent) => {
      if (!active.current || startY.current == null) return;
      const t = e.touches[0];
      const dy = (t?.clientY ?? 0) - startY.current;
      const dx = (t?.clientX ?? 0) - (startX.current ?? 0);
      // Only treat clearly-downward, vertical-dominant drags as a pull, so
      // horizontal swipes (carousels, tab swipes) aren't hijacked.
      if (dy > 0 && dy > Math.abs(dx)) { pullRef.current = Math.min(dy, 120); setPull(pullRef.current); }
    };
    const onEnd = () => {
      if (active.current && pullRef.current >= THRESHOLD) {
        try { sessionStorage.setItem("nami_refreshed", "1"); } catch {}
        window.location.reload();
        return;
      }
      active.current = false; startY.current = null; pullRef.current = 0; setPull(0);
    };
    // Capture phase so list/touchable children can't swallow the gesture before
    // we see it (the reason the pull often didn't register).
    const opts = { passive: true, capture: true } as any;
    window.addEventListener("touchstart", onStart, opts);
    window.addEventListener("touchmove", onMove, opts);
    window.addEventListener("touchend", onEnd, opts);
    return () => {
      window.removeEventListener("touchstart", onStart, opts);
      window.removeEventListener("touchmove", onMove, opts);
      window.removeEventListener("touchend", onEnd, opts);
    };
  }, []);

  if (Platform.OS !== "web" || pull <= 0) return null;
  const ready = pull >= THRESHOLD;
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingTop: Math.max(2, pull - 34), zIndex: 99999 } as any}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surface, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: theme.border, opacity: Math.min(1, pull / 55) }}>
        <Ionicons name={ready ? "arrow-up" : "refresh"} size={15} color={theme.primary} />
        <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: "700" }}>{ready ? "Release to refresh" : "Pull to refresh"}</Text>
      </View>
    </View>
  );
}
