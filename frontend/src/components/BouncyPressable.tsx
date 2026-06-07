import React, { useRef } from "react";
import { Animated, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";

/**
 * Like PressableScale, but keeps the caller's `style` on the Pressable itself
 * (so absolute positioning / fixed sizing — e.g. FABs — is preserved) and
 * springs the *content* on press. Core Animated API (native driver).
 */
type Props = Omit<PressableProps, "style"> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
};

export default function BouncyPressable({
  style, scaleTo = 0.86, children, onPressIn, onPressOut, ...rest
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      style={style}
      onPressIn={(e) => {
        Animated.spring(scale, { toValue: scaleTo, useNativeDriver: true, speed: 50, bounciness: 0 }).start();
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start();
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center", justifyContent: "center" }}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
