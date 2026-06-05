import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/theme";

const formatCard = (t: string) => t.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
const formatExp = (t: string) => {
  const d = t.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  amount: number;
  editableAmount?: boolean;
  allowNote?: boolean;
  cta?: string;
  successText?: string;
  onClose: () => void;
  onPaid: (amount: number, note: string) => Promise<void> | void;
};

const PRESETS = [1, 3, 5, 10, 20, 50];

export default function FakePaymentSheet({
  visible, title, subtitle, amount, editableAmount, allowNote, cta, successText, onClose, onPaid,
}: Props) {
  const insets = useSafeAreaInsets();
  const [amt, setAmt] = useState(String(amount || 0));
  const [note, setNote] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/28");
  const [cvc, setCvc] = useState("123");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (visible) { setAmt(String(amount || 0)); setNote(""); setBusy(false); setDone(false); }
  }, [visible, amount]);

  const value = Math.max(0, Number(amt) || 0);

  const pay = async () => {
    if (value <= 0) return;
    setBusy(true);
    try {
      await new Promise((r) => setTimeout(r, 1200)); // fake processing
      await onPaid(value, note.trim());
      setDone(true);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => !busy && onClose()} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.handle} />
          {done ? (
            <View style={styles.doneWrap}>
              <View style={styles.doneCheck}><Ionicons name="checkmark" size={38} color="#fff" /></View>
              <Text style={styles.doneTitle}>Payment successful</Text>
              <Text style={styles.doneSub}>{successText || `You paid $${value.toFixed(2)}. The money goes to the creator.`}</Text>
              <TouchableOpacity style={styles.payBtn} onPress={onClose} testID="pay-done"><Text style={styles.payBtnText}>Done</Text></TouchableOpacity>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.title}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

              <View style={styles.testBanner}>
                <Ionicons name="lock-closed" size={13} color={theme.primary} />
                <Text style={styles.testBannerText}>Test mode · no real charge</Text>
              </View>

              {editableAmount ? (
                <>
                  <Text style={styles.label}>Amount</Text>
                  <View style={styles.presetRow}>
                    {PRESETS.map((p) => (
                      <TouchableOpacity key={p} onPress={() => setAmt(String(p))} style={[styles.preset, value === p && styles.presetOn]} testID={`amt-${p}`}>
                        <Text style={[styles.presetText, value === p && { color: theme.primary }]}>${p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.inputWrap}>
                    <Text style={styles.dollar}>$</Text>
                    <TextInput style={styles.input} value={amt} onChangeText={(t) => setAmt(t.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" testID="amt-input" />
                  </View>
                </>
              ) : (
                <View style={styles.summary}>
                  <Text style={styles.summaryLabel}>{title}</Text>
                  <Text style={styles.summaryPrice}>${value.toFixed(2)}</Text>
                </View>
              )}

              {allowNote && (
                <>
                  <Text style={styles.label}>Message (optional)</Text>
                  <View style={styles.inputWrap}>
                    <TextInput style={styles.input} value={note} onChangeText={setNote} placeholder="Say something nice…" placeholderTextColor={theme.textMuted} maxLength={200} testID="pay-note" />
                  </View>
                </>
              )}

              <Text style={styles.label}>Card number</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="card-outline" size={18} color={theme.textMuted} />
                <TextInput style={styles.input} value={card} onChangeText={(t) => setCard(formatCard(t))} keyboardType="number-pad" maxLength={19} editable={!busy} testID="pay-card" />
              </View>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expiry</Text>
                  <View style={styles.inputWrap}><TextInput style={styles.input} value={exp} onChangeText={(t) => setExp(formatExp(t))} keyboardType="number-pad" maxLength={5} editable={!busy} /></View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>CVC</Text>
                  <View style={styles.inputWrap}><TextInput style={styles.input} value={cvc} onChangeText={(t) => setCvc(t.replace(/\D/g, "").slice(0, 4))} keyboardType="number-pad" maxLength={4} editable={!busy} /></View>
                </View>
              </View>

              <TouchableOpacity style={[styles.payBtn, (busy || value <= 0) && { opacity: 0.6 }]} onPress={pay} disabled={busy || value <= 0} testID="pay-submit">
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payBtnText}>{cta || "Pay"} ${value.toFixed(2)}</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#0E0E10", borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 12, paddingHorizontal: 18, maxHeight: "88%", borderTopWidth: 1, borderColor: theme.border },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: theme.borderStrong, marginBottom: 14 },
  title: { color: theme.textPrimary, fontSize: 19, fontWeight: "800" },
  subtitle: { color: theme.textMuted, fontSize: 13, marginTop: 2 },
  testBanner: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: theme.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: theme.primary, paddingHorizontal: 10, paddingVertical: 5, marginVertical: 12 },
  testBannerText: { color: theme.primary, fontSize: 12, fontWeight: "700" },
  label: { color: theme.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 6 },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  preset: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  presetOn: { borderColor: theme.primary, backgroundColor: theme.surfaceAlt },
  presetText: { color: theme.textPrimary, fontWeight: "800", fontSize: 14 },
  summary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 14, marginVertical: 6 },
  summaryLabel: { color: theme.textSecondary, fontSize: 14, fontWeight: "600", flex: 1 },
  summaryPrice: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.bg, borderRadius: 12, borderWidth: 1, borderColor: theme.border, paddingHorizontal: 12, height: 48, marginBottom: 8 },
  dollar: { color: theme.textPrimary, fontSize: 16, fontWeight: "800" },
  input: { flex: 1, color: theme.textPrimary, fontSize: 15, height: "100%", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  row: { flexDirection: "row", gap: 12 },
  payBtn: { backgroundColor: theme.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 12 },
  payBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  doneWrap: { alignItems: "center", paddingVertical: 16, gap: 8 },
  doneCheck: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#22C55E", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  doneTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "800" },
  doneSub: { color: theme.textSecondary, fontSize: 13, textAlign: "center", paddingHorizontal: 12, lineHeight: 19 },
});
