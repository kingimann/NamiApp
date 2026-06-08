import React, { useMemo, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Image, ScrollView,
  TextInput, ActivityIndicator, Platform, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { api, CustomEmoji } from "@/src/api/client";
import { useKeyboardHeight } from "@/src/hooks/useKeyboardHeight";
import { theme } from "@/src/theme";
import { EMOJI_CATEGORIES } from "@/src/lib/emojiData";

type Props = {
  visible: boolean;
  emojis: CustomEmoji[];
  myUserId?: string;
  onClose: () => void;
  /** Insert this literal text into the composer (emoji char, or :shortcode:). */
  onPick: (insert: string) => void;
  onChanged: () => void;                       // re-fetch after add/delete
};

const CUSTOM_KEY = "custom";

export default function CustomEmojiSheet({ visible, emojis, myUserId, onClose, onPick, onChanged }: Props) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const [busy, setBusy] = useState(false);
  const [pendingImg, setPendingImg] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [activeCat, setActiveCat] = useState(EMOJI_CATEGORIES[0].key);
  // Foldable: compact by default so it doesn't cover half the screen; tap the
  // handle/chevron to expand for browsing more at once.
  const [expanded, setExpanded] = useState(false);

  // On web the composer keeps focus when the picker opens, so the on-screen
  // keyboard stays up and overlaps the sheet. Blur it whenever the sheet opens.
  React.useEffect(() => {
    if (visible && Platform.OS === "web" && typeof document !== "undefined") {
      (document.activeElement as any)?.blur?.();
    }
  }, [visible]);

  // Tabs: standard categories first, then a Custom tab.
  const tabs = useMemo(
    () => [...EMOJI_CATEGORIES.map((c) => ({ key: c.key, icon: c.icon, custom: false })),
           { key: CUSTOM_KEY, icon: "⭐", custom: true }],
    [],
  );
  const current = EMOJI_CATEGORIES.find((c) => c.key === activeCat);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any, quality: 0.6, base64: true,
      allowsEditing: true, aspect: [1, 1],
    });
    if (res.canceled || !res.assets?.[0]?.base64) return;
    setPendingImg(`data:image/png;base64,${res.assets[0].base64}`);
  };

  const upload = async () => {
    const c = code.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!c || !pendingImg) return;
    setBusy(true);
    try {
      await api.createCustomEmoji(c, pendingImg);
      setPendingImg(null); setCode("");
      onChanged();
    } catch (e: any) {
      Alert.alert("Couldn't add emoji", e?.message || "Try a different shortcode.");
    } finally { setBusy(false); }
  };

  const remove = async (em: CustomEmoji) => {
    try { await api.deleteCustomEmoji(em.id); onChanged(); } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { height: expanded ? "84%" : "42%", paddingBottom: insets.bottom + 12, marginBottom: kb }]}>
          <TouchableOpacity
            onPress={() => setExpanded((v) => !v)}
            activeOpacity={0.7}
            style={styles.handleHit}
            testID="emoji-handle"
          >
            <View style={styles.handle} />
          </TouchableOpacity>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {activeCat === CUSTOM_KEY ? "Custom emojis" : (current?.label || "Emojis")}
            </Text>
            <View style={styles.titleActions}>
              <TouchableOpacity onPress={() => setExpanded((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="emoji-fold">
                <Ionicons name={expanded ? "chevron-down" : "chevron-up"} size={22} color={theme.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} testID="emoji-close">
                <Ionicons name="close" size={22} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tabBarScroll}
            contentContainerStyle={styles.tabBar}
          >
            {tabs.map((t) => {
              const active = t.key === activeCat;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.tab, active && styles.tabActive]}
                  onPress={() => setActiveCat(t.key)}
                  testID={`emoji-cat-${t.key}`}
                >
                  <Text style={styles.tabIcon}>{t.icon}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {activeCat === CUSTOM_KEY ? (
            <>
              {/* Upload row */}
              <View style={styles.uploadRow}>
                <TouchableOpacity style={styles.imgPick} onPress={pickImage} testID="emoji-pick-image">
                  {pendingImg ? (
                    <Image source={{ uri: pendingImg }} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  ) : (
                    <Ionicons name="image" size={22} color={theme.primary} />
                  )}
                </TouchableOpacity>
                <View style={styles.codeWrap}>
                  <Text style={styles.colon}>:</Text>
                  <TextInput
                    style={styles.codeInput}
                    placeholder="shortcode"
                    placeholderTextColor={theme.textMuted}
                    value={code}
                    onChangeText={(t) => setCode(t.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    autoCapitalize="none"
                    maxLength={32}
                    testID="emoji-code"
                  />
                  <Text style={styles.colon}>:</Text>
                </View>
                <TouchableOpacity
                  style={[styles.addBtn, (!pendingImg || !code.trim() || busy) && { opacity: 0.5 }]}
                  onPress={upload}
                  disabled={!pendingImg || !code.trim() || busy}
                  testID="emoji-upload"
                >
                  {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.addBtnText}>Add</Text>}
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.grid} keyboardShouldPersistTaps="handled">
                {emojis.length === 0 ? (
                  <Text style={styles.empty}>No custom emojis yet. Upload one above, then use it as :shortcode: in chat.</Text>
                ) : emojis.map((em) => (
                  <TouchableOpacity
                    key={em.id}
                    style={styles.customCell}
                    onPress={() => onPick(`:${em.shortcode}: `)}
                    onLongPress={() => em.owner_id === myUserId && remove(em)}
                    testID={`emoji-${em.shortcode}`}
                  >
                    <Image source={{ uri: em.image_base64 }} style={{ width: 34, height: 34 }} resizeMode="contain" />
                    <Text style={styles.emojiCode} numberOfLines={1}>:{em.shortcode}:</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {emojis.some((e) => e.owner_id === myUserId) && (
                <Text style={styles.hint}>Long-press your own emoji to delete it.</Text>
              )}
            </>
          ) : (
            <ScrollView contentContainerStyle={styles.uniGrid} keyboardShouldPersistTaps="handled">
              {(current?.emojis || []).map((em, i) => (
                <TouchableOpacity
                  key={`${em}-${i}`}
                  style={styles.uniCell}
                  onPress={() => onPick(em)}
                  testID={`emoji-char-${activeCat}-${i}`}
                >
                  <Text style={styles.uniEmoji}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#0E0E10", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 6, paddingHorizontal: 14,
    borderTopWidth: 1, borderColor: theme.border,
  },
  // Bigger touch target around the grab handle so it's easy to fold/unfold.
  handleHit: { alignSelf: "center", paddingVertical: 6, paddingHorizontal: 30 },
  handle: { width: 44, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10, marginTop: 4 },
  title: { color: theme.textPrimary, fontSize: 17, fontWeight: "800", flex: 1 },
  titleActions: { flexDirection: "row", alignItems: "center", gap: 14 },
  tabBarScroll: { flexGrow: 0, marginBottom: 10 },
  tabBar: { paddingBottom: 2, paddingRight: 8 },
  tab: { width: 40, height: 40, borderRadius: 12, marginRight: 8, alignItems: "center", justifyContent: "center", backgroundColor: theme.surface, borderWidth: 1, borderColor: "transparent" },
  tabActive: { borderColor: theme.primary, backgroundColor: theme.surfaceAlt },
  tabIcon: { fontSize: 19 },
  uniGrid: { flexDirection: "row", flexWrap: "wrap", paddingBottom: 16, paddingHorizontal: 2 },
  // 6 columns with a fixed cell height (not aspectRatio) so rows never
  // collapse/overlap on web and emojis stay evenly aligned with breathing room.
  uniCell: { width: "16.6666%", height: 50, alignItems: "center", justifyContent: "center" },
  uniEmoji: { fontSize: 28, ...(Platform.OS === "web" ? ({ lineHeight: 38 } as object) : {}) },
  uploadRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  imgPick: {
    width: 50, height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderStyle: "dashed",
  },
  codeWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 10, height: 46,
  },
  colon: { color: theme.textMuted, fontSize: 16, fontWeight: "800" },
  codeInput: { flex: 1, color: theme.textPrimary, fontSize: 15, paddingHorizontal: 4, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  addBtn: { backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 16, height: 46, alignItems: "center", justifyContent: "center" },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 8 },
  customCell: { width: 64, alignItems: "center", gap: 3, paddingVertical: 6 },
  emojiCode: { color: theme.textMuted, fontSize: 9.5 },
  empty: { color: theme.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 24, paddingHorizontal: 20 },
  hint: { color: theme.textMuted, fontSize: 11, textAlign: "center", marginTop: 6 },
});
