import React from "react";
import { Platform, View, StyleSheet, useWindowDimensions } from "react-native";
import { theme } from "@/src/theme";

// Width the mobile layout is designed for. On screens wider than BREAKPOINT
// (desktop / tablet web) we pin the whole app to a centred phone-width column so
// the mobile UI never stretches, reflows, or breaks — it always looks and
// navigates like the phone app. On phones (and all native) this is a no-op.
const FRAME_MAX = 480;
const BREAKPOINT = 600;

export default function MobileFrame({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const constrain = Platform.OS === "web" && width > BREAKPOINT;

  if (!constrain) return <View style={styles.full}>{children}</View>;

  return (
    <View style={styles.backdrop}>
      <View style={styles.frame}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1 },
  // Dark backdrop with a little breathing room so the column reads as a device.
  backdrop: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", paddingVertical: 22 },
  // A floating, rounded phone-app window with a soft shadow.
  frame: {
    flex: 1,
    width: FRAME_MAX,
    maxWidth: "100%",
    alignSelf: "center",
    backgroundColor: theme.bg,
    overflow: "hidden",
    position: "relative",
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 10 },
  },
});
