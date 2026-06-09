import React from "react";
import { View, StyleSheet, Platform, useWindowDimensions } from "react-native";
import { theme } from "@/src/theme";

// PC = the mobile app, fitted to desktop: the same mobile UI centred in a
// comfortable column (so it isn't stretched edge-to-edge) with subtle side
// borders. No phone-frame chrome, no separate desktop nav — the mobile bottom
// bar / header are used as-is. Passthrough on phones and native.
const BREAKPOINT = 700;   // below this, use the mobile layout untouched
const COLUMN_MAX = 600;   // comfortable reading width on desktop

export default function DesktopShell({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const constrain = Platform.OS === "web" && width > BREAKPOINT;
  if (!constrain) return <>{children}</>;
  return (
    <View style={styles.backdrop}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", backgroundColor: theme.bg },
  column: {
    flex: 1, width: "100%", maxWidth: COLUMN_MAX,
    borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
});
