import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput,
  ActivityIndicator, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { safeBack } from "@/src/utils/nav";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { assetToUri } from "@/src/utils/thumbnail";
import { api, BusinessProfile } from "@/src/api/client";
import { useConfirm } from "@/src/context/ConfirmContext";
import { theme } from "@/src/theme";
import { ACCENT_COLORS, resolveAccent, isValidHex, accentGradient } from "@/src/lib/profileCustomize";

// A business storefront is a SEPARATE selling identity from the user's personal
// profile. It carries its own brand, contact details and listings. If the
// owner's personal account is ever banned, the storefront is banned with it.
export default function BusinessEditorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<BusinessProfile | null>(null);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("");
  const [policies, setPolicies] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [accent, setAccent] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const b = await api.myBusiness();
        if (b) {
          setExisting(b);
          setName(b.name || "");
          setTagline(b.tagline || "");
          setBio(b.bio || "");
          setCategory(b.category || "");
          setPolicies(b.policies || "");
          setLocation(b.location || "");
          setEmail(b.contact_email || "");
          setPhone(b.contact_phone || "");
          setWebsite(b.website || "");
          setLogo(b.logo || null);
          setBanner(b.banner || null);
          setAccent(b.accent || "");
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, []);

  const previewAccent = resolveAccent(accent);

  const pick = async (aspect: [number, number], set: (uri: string) => void) => {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, allowsEditing: true, aspect, quality: 0.7, base64: true });
    if (res.canceled || !res.assets?.[0]) return;
    const uri = await assetToUri(res.assets[0], "image");
    if (uri) set(uri);
  };

  const save = async () => {
    if (!name.trim()) { setErr("Give your business a name."); return; }
    setSaving(true); setErr("");
    try {
      const b = await api.saveBusiness({
        name: name.trim(),
        tagline: tagline.trim(),
        bio: bio.trim(),
        category: category.trim(),
        policies: policies.trim(),
        location: location.trim(),
        contact_email: email.trim(),
        contact_phone: phone.trim(),
        website: website.trim(),
        logo: logo || "",
        banner: banner || "",
        accent: accent && isValidHex(accent) ? accent : "",
      });
      setExisting(b);
      safeBack();
    } catch (e: any) {
      setErr(String(e?.message || e).replace(/^\d{3}:\s*/, "") || "Couldn't save your business.");
    } finally { setSaving(false); }
  };

  const closeShop = async () => {
    const ok = await confirm({
      title: "Close storefront?",
      message: "Your business profile is removed. Its listings move back to your personal profile — they aren't deleted.",
      confirmLabel: "Close storefront",
      cancelLabel: "Keep",
      destructive: true,
    });
    if (!ok) return;
    setSaving(true);
    try { await api.deleteBusiness(); safeBack(); }
    catch (e: any) { setErr(String(e?.message || e)); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <SafeAreaView edges={["top"]} style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="business-editor-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} hitSlop={10} testID="business-back">
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{existing ? "Your business" : "New business"}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={styles.note}>A business profile is separate from your personal profile. Buyers see it as its own shop, and you can list items under it. If your personal account is ever banned, your business is banned too.</Text>

        {/* Live preview */}
        <View style={styles.preview}>
          {banner ? (
            <Image source={{ uri: banner }} style={styles.previewBanner} resizeMode="cover" />
          ) : (
            <LinearGradient colors={accentGradient(accent)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.previewBanner} />
          )}
          <View style={styles.previewBody}>
            <View style={[styles.previewLogo, { borderColor: previewAccent }]}>
              {logo ? <Image source={{ uri: logo }} style={{ width: "100%", height: "100%" }} /> : <Ionicons name="business" size={26} color={previewAccent} />}
            </View>
            <Text style={styles.previewName} numberOfLines={1}>{name.trim() || "Your business"}</Text>
            {!!tagline.trim() && <Text style={styles.previewTagline} numberOfLines={2}>{tagline.trim()}</Text>}
          </View>
        </View>

        {!!existing && (
          <TouchableOpacity style={styles.viewBtn} onPress={() => router.push({ pathname: "/business/[id]", params: { id: existing.id } })} testID="business-view">
            <Ionicons name="storefront-outline" size={16} color={theme.primary} />
            <Text style={styles.viewBtnText}>View storefront{existing.listing_count ? ` · ${existing.listing_count} listing${existing.listing_count === 1 ? "" : "s"}` : ""}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Business name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Northside Vintage" placeholderTextColor={theme.textMuted} maxLength={60} testID="business-name" />

        <Text style={styles.label}>Tagline</Text>
        <TextInput style={styles.input} value={tagline} onChangeText={setTagline} placeholder="What you sell, in a line" placeholderTextColor={theme.textMuted} maxLength={120} testID="business-tagline" />

        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Clothing, Electronics, Handmade" placeholderTextColor={theme.textMuted} maxLength={40} testID="business-category" />

        <Text style={styles.label}>About</Text>
        <TextInput style={[styles.input, { height: 90, textAlignVertical: "top" }]} value={bio} onChangeText={setBio} placeholder="Tell buyers about your business" placeholderTextColor={theme.textMuted} multiline maxLength={1000} testID="business-bio" />

        <Text style={styles.label}>Logo</Text>
        <View style={styles.mediaRow}>
          <TouchableOpacity style={styles.logoBtn} onPress={() => pick([1, 1], setLogo)} testID="business-logo-pick">
            {logo ? <Image source={{ uri: logo }} style={styles.logoImg} /> : <Ionicons name="image-outline" size={22} color={theme.textMuted} />}
          </TouchableOpacity>
          {!!logo && <TouchableOpacity onPress={() => setLogo(null)} style={styles.removeBtn}><Text style={styles.removeText}>Remove</Text></TouchableOpacity>}
        </View>

        <Text style={styles.label}>Banner</Text>
        <TouchableOpacity style={styles.bannerBtn} onPress={() => pick([3, 1], setBanner)} testID="business-banner-pick">
          {banner ? <Image source={{ uri: banner }} style={styles.bannerImg} resizeMode="cover" /> : (
            <View style={styles.bannerEmpty}><Ionicons name="image-outline" size={22} color={theme.textMuted} /><Text style={styles.bannerEmptyText}>Add a banner</Text></View>
          )}
        </TouchableOpacity>
        {!!banner && <TouchableOpacity onPress={() => setBanner(null)}><Text style={styles.removeText}>Remove banner</Text></TouchableOpacity>}

        <Text style={styles.label}>Accent color</Text>
        <View style={styles.swatchRow}>
          {ACCENT_COLORS.map((c) => {
            const on = (accent || "").toLowerCase() === c.toLowerCase();
            return (
              <TouchableOpacity key={c} style={[styles.swatchWrap, on && { borderColor: theme.primary, backgroundColor: theme.surfaceAlt }]} onPress={() => setAccent(c)} testID={`business-accent-${c}`}>
                <View style={[styles.swatch, { backgroundColor: c }]}>{on ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}</View>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity style={[styles.swatchWrap, !accent && { borderColor: theme.primary, backgroundColor: theme.surfaceAlt }]} onPress={() => setAccent("")} testID="business-accent-clear">
            <View style={[styles.swatch, { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}><Ionicons name="refresh" size={14} color={theme.textMuted} /></View>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City, region" placeholderTextColor={theme.textMuted} maxLength={120} testID="business-location" />

        <Text style={styles.label}>Contact email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="shop@example.com" placeholderTextColor={theme.textMuted} autoCapitalize="none" keyboardType="email-address" maxLength={120} testID="business-email" />

        <Text style={styles.label}>Contact phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="Optional" placeholderTextColor={theme.textMuted} keyboardType="phone-pad" maxLength={40} testID="business-phone" />

        <Text style={styles.label}>Website</Text>
        <TextInput style={styles.input} value={website} onChangeText={setWebsite} placeholder="https://" placeholderTextColor={theme.textMuted} autoCapitalize="none" keyboardType="url" maxLength={200} testID="business-website" />

        <Text style={styles.label}>Shop policies</Text>
        <TextInput style={[styles.input, { height: 90, textAlignVertical: "top" }]} value={policies} onChangeText={setPolicies} placeholder="Shipping, returns, meetup spots…" placeholderTextColor={theme.textMuted} multiline maxLength={1000} testID="business-policies" />

        {!!err && <Text style={styles.err}>{err}</Text>}
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} testID="business-save">
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>{existing ? "Save business" : "Create business"}</Text>}
        </TouchableOpacity>

        {!!existing && (
          <TouchableOpacity style={styles.closeBtn} onPress={closeShop} disabled={saving} testID="business-close">
            <Text style={styles.closeText}>Close storefront</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: theme.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  note: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18, marginBottom: 14 },
  preview: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 12 },
  previewBanner: { width: "100%", height: 90, backgroundColor: theme.surfaceAlt },
  previewBody: { alignItems: "center", paddingBottom: 14, marginTop: -28, gap: 2 },
  previewLogo: { width: 56, height: 56, borderRadius: 28, borderWidth: 3, overflow: "hidden", backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" },
  previewName: { color: theme.textPrimary, fontSize: 17, fontWeight: "800", marginTop: 6 },
  previewTagline: { color: theme.textSecondary, fontSize: 13, textAlign: "center", paddingHorizontal: 20 },
  viewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, marginBottom: 4 },
  viewBtnText: { color: theme.primary, fontWeight: "700", fontSize: 13.5 },
  label: { color: theme.textSecondary, fontSize: 12, fontWeight: "700", marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: theme.textPrimary, fontSize: 14, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : {}) },
  mediaRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  bannerBtn: { borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  bannerImg: { width: "100%", height: 96 },
  bannerEmpty: { height: 96, alignItems: "center", justifyContent: "center", gap: 6 },
  bannerEmptyText: { color: theme.textMuted, fontSize: 13, fontWeight: "600" },
  removeBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  removeText: { color: theme.error, fontSize: 13, fontWeight: "700", marginTop: 6 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  swatchWrap: { padding: 3, borderRadius: 22, borderWidth: 2, borderColor: "transparent" },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  err: { color: theme.error, fontSize: 13, fontWeight: "600", marginTop: 14 },
  saveBtn: { marginTop: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: theme.primary, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  closeBtn: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  closeText: { color: theme.error, fontWeight: "700", fontSize: 14 },
});
