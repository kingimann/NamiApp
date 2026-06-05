import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "@/src/theme";

/**
 * Inline video embed (YouTube / Twitch / Vimeo). Mirrors MapboxWebView: a raw
 * <iframe> on web, react-native-webview on native — so the player is actually
 * playable in-feed, not just a link preview.
 */
export default function EmbedCard({ url, aspect = 16 / 9 }: { url: string; aspect?: number }) {
  return (
    <View style={[styles.wrap, { aspectRatio: aspect }]} testID="embed-card">
      {Platform.OS === "web" ? (
        <iframe
          src={url}
          style={{ border: "none", width: "100%", height: "100%", background: "#000" } as any}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%", marginTop: 8, borderRadius: 14, overflow: "hidden",
    backgroundColor: "#000", borderWidth: 1, borderColor: theme.border,
  },
  webview: { flex: 1, backgroundColor: "#000" },
});
