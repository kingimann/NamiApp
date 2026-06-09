import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { theme } from "@/src/theme";

// Shown for routes expo-router can't match. (Single-segment paths are caught by
// the vanity [username] route, which renders its own "user not found" state.)
export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.root} testID="not-found-screen">
      <Stack.Screen options={{ headerShown: false, title: "Not found" }} />
      <View style={styles.body}>
        <Ionicons name="compass-outline" size={48} color={theme.textMuted} />
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.sub}>That link doesn’t lead anywhere on OkaySpace.</Text>
        <TouchableOpacity style={styles.btn} onPress={() => router.replace("/")} testID="not-found-home">
          <Text style={styles.btnText}>Go home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 30 },
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: "800", marginTop: 4 },
  sub: { color: theme.textMuted, fontSize: 14, textAlign: "center" },
  btn: { marginTop: 14, backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
