import React from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { frameColors, backgroundColors } from "@/src/lib/profileCustomize";

// A Steam-style decorative ring around an avatar. Renders `children` (the
// avatar) inside a gradient border; with no frame it just renders the child.
export function AvatarFrame({
  frame, size, ring = 4, children, style,
}: {
  frame?: string | null;
  size: number;             // diameter of the avatar inside
  ring?: number;            // thickness of the decorative ring
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = frameColors(frame);
  if (colors.length < 2) {
    return <View style={style}>{children}</View>;
  }
  const outer = size + ring * 2;
  return (
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: outer, height: outer, borderRadius: outer / 2, padding: ring, alignItems: "center", justifyContent: "center" }, style]}
    >
      {children}
    </LinearGradient>
  );
}

// A themed gradient painted behind the whole profile (absolute fill). Returns
// null for the default (app background) so nothing is drawn. `style` lets a
// padded parent bleed the fill into its gutters (e.g. { left: -20, right: -20 }).
export function ProfileBackground({
  background, style,
}: { background?: string | null; style?: StyleProp<ViewStyle> }) {
  const colors = backgroundColors(background);
  if (colors.length < 2) return null;
  return (
    <LinearGradient
      colors={colors as any}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}
