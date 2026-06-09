import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { safeBack } from "@/src/utils/nav";
import { theme } from "@/src/theme";

// Effective date — keep this in sync with TOS_VERSION / PRIVACY_VERSION in
// backend/core.py. Bumping those versions re-prompts every user to re-accept.
const EFFECTIVE = "June 9, 2026";

type Section = { h: string; p?: string; bullets?: string[] };

const TERMS: Section[] = [
  {
    h: "1. Acceptance of These Terms",
    p: "These Terms of Service (the “Terms”) form a binding agreement between you and OkaySpace (“OkaySpace”, “we”, “us”, or “our”) governing your access to and use of the OkaySpace application, websites, and related services (collectively, the “Service”). By creating an account, clicking “I agree”, or otherwise accessing or using the Service, you confirm that you have read, understood, and agree to be bound by these Terms and by our Privacy Policy, which is incorporated here by reference. If you do not agree, you must not use the Service.",
  },
  {
    h: "2. Eligibility",
    p: "You must be at least 13 years old, or the minimum age of digital consent in your country (for example, 16 in parts of the European Economic Area), to use the Service. If you are under the age of majority where you live, you may only use the Service with the involvement and consent of a parent or legal guardian. By using the Service you represent that you meet these requirements and that you are not barred from using it under any applicable law, and that you have not been previously suspended or removed from the Service.",
  },
  {
    h: "3. Your Account",
    p: "To use most features you must create an account and choose a unique username. You agree to provide accurate information and to keep it up to date. You are responsible for safeguarding your password and any API keys, for all activity that occurs under your account, and for any saved-login profiles you keep on a device. Notify us immediately if you suspect unauthorized access. We may require periodic re-authentication (such as re-entering your password) to protect your account. You may not share, sell, or transfer your account, or impersonate another person or entity.",
  },
  {
    h: "4. Your Content & License to Us",
    p: "“Your Content” means anything you create, upload, post, or share through the Service — including posts, comments, messages, photos, videos, listings, business storefront details, reviews, and profile information. You retain ownership of Your Content. By submitting it, you grant OkaySpace a non-exclusive, worldwide, royalty-free, sublicensable license to host, store, reproduce, modify (for example, to resize images or transcode video), display, and distribute Your Content solely to operate, provide, and improve the Service and as permitted by your privacy and audience settings. This license ends when you delete Your Content, except for content others have re-shared, content retained in backups for a limited period, or where retention is required by law.",
  },
  {
    h: "5. Acceptable Use",
    p: "You agree not to use the Service to do any of the following, and not to enable or encourage others to do so:",
    bullets: [
      "Post or transmit content that is illegal, fraudulent, defamatory, obscene, sexually exploitative (especially involving minors), or that infringes anyone's intellectual-property or privacy rights.",
      "Harass, bully, threaten, dox, or incite violence or hatred against any person or group.",
      "Spam, run scams, manipulate engagement, operate fake or bot accounts, or post deceptive marketplace listings.",
      "Upload malware, attempt to gain unauthorized access to accounts or systems, probe or scrape the Service, or circumvent rate limits, security, or moderation.",
      "Misrepresent your identity, affiliation, or the origin of content, or use the Service to violate any applicable law or regulation.",
      "Interfere with or disrupt the integrity or performance of the Service or the data it contains.",
    ],
  },
  {
    h: "6. Marketplace & Business Storefronts",
    p: "OkaySpace lets users list items for sale and operate business storefronts that are separate from their personal profile. You are solely responsible for your listings, the accuracy of their descriptions and prices, and for completing transactions lawfully. OkaySpace is a venue only; we are not a party to transactions between buyers and sellers, do not guarantee any item, and are not responsible for the quality, safety, legality, or delivery of listed goods. You must comply with all laws applicable to your sales (including tax, consumer-protection, and product-safety laws). A business storefront is tied to the personal account that owns it: if that personal account is suspended or banned, the associated business storefront is disabled as well. Prohibited, recalled, counterfeit, and restricted items may not be listed.",
  },
  {
    h: "7. Payments, Wallet, Tips & Subscriptions",
    p: "The Service may offer a wallet, tipping, creator subscriptions, paid promotions, and other paid features. Where real payments are processed, they are handled by third-party payment processors, and you authorize the applicable charges and agree to the processor's terms. Prices, fees, payout thresholds, and payout schedules are shown in the relevant screens before you commit. Except where required by law, payments and platform fees are non-refundable. You are responsible for any taxes arising from money you receive. Subscriptions renew on the cadence shown until cancelled. We may withhold, reverse, or freeze funds where we reasonably suspect fraud, chargeback abuse, or a violation of these Terms.",
  },
  {
    h: "8. Advertising & Promotions",
    p: "If you promote a post or run ads, you are responsible for the content of your promotion and for complying with applicable advertising laws and disclosure rules. We may review, label, reject, or remove promotions and may set or change pricing, targeting limits, and eligibility. Budgets and charges for promotions are shown before they run.",
  },
  {
    h: "9. Developer API",
    p: "Access to the developer API is governed by these Terms and any plan-specific limits. API keys are tied to your account and must be kept secret; you are responsible for all activity under your keys. You agree to respect rate limits, quotas, and scopes, to handle end-user data lawfully, and not to use the API to replicate the Service, build a competing product from bulk-exported data, or circumvent restrictions. We may rate-limit, suspend, or revoke keys that abuse the Service or violate these Terms, and we may change or discontinue API features with reasonable notice where practical.",
  },
  {
    h: "10. Communities & Groups",
    p: "Communities and groups may have their own rules and volunteer moderators in addition to these Terms. Moderators may remove content and members within their community consistent with our policies, but they act on their own behalf, not as agents of OkaySpace. We may step in to enforce these Terms anywhere on the Service. You remain responsible for your conduct in every community and group you join.",
  },
  {
    h: "11. Intellectual Property",
    p: "The Service itself — including its software, design, logos, and trademarks — is owned by OkaySpace or its licensors and is protected by intellectual-property laws. Except for the rights expressly granted to you, we reserve all rights. You may not copy, modify, distribute, reverse-engineer, or create derivative works of the Service except as permitted by law. If you believe content on the Service infringes your copyright, contact us with the details required to process a takedown request, and we will respond as required by applicable law.",
  },
  {
    h: "12. Third-Party Services & Links",
    p: "The Service may link to or integrate third-party websites, content, maps, and services that we do not control. We are not responsible for third-party content or practices, and your use of them is governed by their own terms and privacy policies.",
  },
  {
    h: "13. Suspension & Termination",
    p: "You may stop using the Service and delete your account at any time from Settings. We may suspend, restrict, or terminate your access — with or without notice — if you violate these Terms or the law, if your account creates risk or legal exposure for us or others, or if required by law. Upon termination, your right to use the Service ends. Sections that by their nature should survive termination (for example, content license for already-shared content, disclaimers, limitation of liability, and indemnity) will continue to apply.",
  },
  {
    h: "14. Disclaimers",
    p: "The Service is provided “as is” and “as available”, without warranties of any kind, whether express, implied, or statutory, including any implied warranties of merchantability, fitness for a particular purpose, title, and non-infringement. We do not warrant that the Service will be uninterrupted, secure, error-free, or that any content, location data, directions, or user is accurate or reliable. Use the Service, and any location or navigation feature, at your own discretion and risk.",
  },
  {
    h: "15. Limitation of Liability",
    p: "To the maximum extent permitted by law, OkaySpace and its affiliates, officers, employees, and agents will not be liable for any indirect, incidental, special, consequential, exemplary, or punitive damages, or for any loss of profits, data, goodwill, or other intangible losses, arising from or related to your use of (or inability to use) the Service. To the maximum extent permitted by law, our total liability for any claim relating to the Service will not exceed the greater of the amount you paid us for the Service in the twelve months before the event giving rise to the claim, or USD $100. Some jurisdictions do not allow certain limitations, so some of these may not apply to you.",
  },
  {
    h: "16. Indemnification",
    p: "You agree to indemnify and hold harmless OkaySpace and its affiliates from and against any claims, damages, losses, liabilities, and expenses (including reasonable legal fees) arising out of or related to Your Content, your use of the Service, your violation of these Terms, or your violation of any law or the rights of a third party.",
  },
  {
    h: "17. Governing Law & Dispute Resolution",
    p: "These Terms are governed by the laws of the jurisdiction in which OkaySpace operates, without regard to conflict-of-law principles. You agree to first try to resolve any dispute with us informally by contacting us. Where permitted, disputes that cannot be resolved informally will be handled by the competent courts of that jurisdiction. Nothing in these Terms limits any non-waivable rights you have under the mandatory consumer laws of your country of residence.",
  },
  {
    h: "18. Changes to These Terms",
    p: "We may update these Terms from time to time. When we make material changes, we will update the effective date and, before you continue using the Service, ask you to review and accept the updated version. The “I agree” prompt that appears after a material update records your acceptance. Continued use of the Service after changes take effect means you accept the revised Terms.",
  },
  {
    h: "19. Contact",
    p: "Questions about these Terms can be sent to the app administrator through the in-app Support & disputes screen.",
  },
];

const PRIVACY: Section[] = [
  {
    h: "1. Introduction",
    p: "This Privacy Policy explains how OkaySpace (“we”, “us”, or “our”) collects, uses, shares, and protects information about you when you use the Service. It applies to all OkaySpace features, including the social feed, messaging, marketplace and business storefronts, communities and groups, maps and location features, the wallet and payments, advertising, and the developer API. By using the Service, you agree to the practices described here. Terms not defined here have the meaning given in our Terms of Service.",
  },
  {
    h: "2. Information You Provide",
    p: "We collect information you give us directly, including:",
    bullets: [
      "Account details: your name, username, email address, password (stored only as a salted hash), and any optional phone number.",
      "Profile information: bio, avatar, cover photo, links, interests, pronouns, and other details you add.",
      "Content: posts, comments, reactions, direct and group messages, stories, marketplace listings, business storefront details, reviews, and forms you submit.",
      "Transactions: items you buy or sell, tips, subscriptions, payout preferences, and limited payment details handled through our payment processors.",
      "Support and verification: messages you send to support, dispute details, and any identity or document verification you choose to complete.",
    ],
  },
  {
    h: "3. Information We Collect Automatically",
    p: "When you use the Service, we automatically collect certain information, including:",
    bullets: [
      "Usage data: features you use, content you view or interact with, search queries, and timestamps.",
      "Device and connection data: device type, operating system, app version, language, and IP address.",
      "Approximate or precise location, where you enable location features (see Section 4).",
      "Diagnostics: crash logs and performance data used to keep the Service working.",
    ],
  },
  {
    h: "4. Location Data",
    p: "If you use maps, directions, nearby places, distance on listings, or other location-based features, we process your device location to provide them. On mobile, you control whether the app may access precise or approximate location through your device settings, and you can turn it off at any time. Some features (such as showing how far away a listing is) will not work, or will be less accurate, without location access. Sharing your live location or estimated time of arrival with others is always something you choose to start and can stop.",
  },
  {
    h: "5. How We Use Information",
    p: "We use the information we collect to:",
    bullets: [
      "Provide, operate, and maintain the Service — authenticate you, deliver your feed, messages, and notifications, and power search, maps, and directions.",
      "Enable transactions — process marketplace activity, the wallet, tips, subscriptions, payouts, and promotions.",
      "Personalize your experience and recommend relevant content, people, communities, and listings.",
      "Keep the platform safe — detect and prevent spam, fraud, abuse, and violations of our Terms, including automated and human moderation.",
      "Communicate with you about updates, security alerts, and support requests.",
      "Comply with legal obligations and enforce our agreements.",
    ],
  },
  {
    h: "6. Legal Bases for Processing",
    p: "Where the laws of your region (such as the EEA or UK GDPR) require a legal basis, we rely on: performance of our contract with you (to provide the Service you request); your consent (for example, for precise location or certain notifications, which you may withdraw at any time); our legitimate interests (such as securing the Service, preventing abuse, and improving features), balanced against your rights; and compliance with legal obligations.",
  },
  {
    h: "7. How We Share Information",
    p: "We do not sell your personal information. We share information only as follows:",
    bullets: [
      "With other users, according to your audience and privacy settings — for example, your profile, public posts, listings, and storefront are visible to the audiences you choose.",
      "With service providers who help us operate the Service (such as cloud hosting, content-delivery networks for media, and payment processors), under contracts that limit their use of the data.",
      "For legal reasons — to comply with the law, respond to lawful requests, or protect the rights, safety, and property of OkaySpace, our users, or the public.",
      "In a business transfer — if OkaySpace is involved in a merger, acquisition, or sale of assets, with notice consistent with this Policy.",
      "With your consent, for any other purpose disclosed at the time.",
    ],
  },
  {
    h: "8. Payments & Financial Information",
    p: "Payments are processed by third-party payment processors. We do not store full card numbers; sensitive payment details are handled by the processor under their own security standards and privacy terms. We retain records of transactions (such as amounts, dates, and counterparties) as needed to provide the wallet, payouts, dispute resolution, fraud prevention, and to meet legal and accounting obligations.",
  },
  {
    h: "9. Cookies & Similar Technologies",
    p: "We and our providers use cookies, local storage, and similar technologies to keep you signed in, remember your preferences (such as saved login profiles), measure performance, and protect against abuse. You can control these through your browser or device settings, though some features may not function without them.",
  },
  {
    h: "10. Data Retention",
    p: "We keep your information for as long as your account is active or as needed to provide the Service. When you delete content or your account, we delete or anonymize the associated personal data within a reasonable period, except where we must retain it to comply with legal obligations, resolve disputes, prevent fraud, or enforce our agreements, and except for limited copies that may persist in backups for a short time.",
  },
  {
    h: "11. Security",
    p: "We use reasonable technical and organizational measures to protect your information — including hashing passwords, encrypting data in transit, and restricting internal access. Direct messages may be protected with additional encryption. No method of transmission or storage is perfectly secure, so we cannot guarantee absolute security. Please use a strong, unique password and enable available security options.",
  },
  {
    h: "12. Your Rights & Choices",
    p: "Depending on where you live, you may have the right to:",
    bullets: [
      "Access the personal information we hold about you and request a copy.",
      "Correct or update inaccurate information — much of which you can edit yourself in Settings.",
      "Delete your account and associated personal data.",
      "Object to or restrict certain processing, and withdraw consent where processing is based on consent.",
      "Request portability of certain information, and lodge a complaint with your local data-protection authority.",
    ],
  },
  {
    h: "13. Children's Privacy",
    p: "The Service is not directed to children under the minimum age described in our Terms, and we do not knowingly collect personal information from them. If we learn that we have collected such information without appropriate consent, we will delete it. If you believe a child has provided us information, please contact us.",
  },
  {
    h: "14. International Data Transfers",
    p: "We may process and store information in countries other than where you live, which may have different data-protection laws. Where required, we use appropriate safeguards (such as standard contractual clauses) to protect information transferred across borders.",
  },
  {
    h: "15. Third-Party Services",
    p: "The Service may link to or integrate third-party services (such as maps, sign-in providers, and content delivery). Their handling of your information is governed by their own privacy policies, which we encourage you to review.",
  },
  {
    h: "16. Changes to This Policy",
    p: "We may update this Privacy Policy from time to time. When we make material changes, we will update the effective date and ask you to review and accept the updated version before you continue using the Service. Continued use after changes take effect means you accept the revised Policy.",
  },
  {
    h: "17. Contact",
    p: "Questions or requests about your privacy can be sent to the app administrator through the in-app Support & disputes screen.",
  },
];

export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const isPrivacy = doc === "privacy";
  const sections = isPrivacy ? PRIVACY : TERMS;
  const title = isPrivacy ? "Privacy Policy" : "Terms of Service";

  return (
    <SafeAreaView edges={["top"]} style={styles.root} testID="legal-screen">
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeBack()} style={styles.backBtn} testID="legal-back">
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.docTitle}>{isPrivacy ? "OkaySpace Privacy Policy" : "OkaySpace Terms of Service"}</Text>
        <Text style={styles.effective}>Effective {EFFECTIVE}</Text>
        {sections.map((s, i) => (
          <View key={i} style={{ marginTop: 18 }}>
            <Text style={styles.h}>{s.h}</Text>
            {!!s.p && <Text style={styles.p}>{s.p}</Text>}
            {!!s.bullets && s.bullets.map((b, j) => (
              <View key={j} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{b}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.footer}>
          By continuing to use OkaySpace you acknowledge that you have read and agree to {isPrivacy ? "this Privacy Policy" : "these Terms of Service"}.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: theme.textPrimary, fontSize: 18, fontWeight: "800", textAlign: "center" },
  docTitle: { color: theme.textPrimary, fontSize: 21, fontWeight: "800", marginBottom: 4 },
  effective: { color: theme.textMuted, fontSize: 13 },
  h: { color: theme.textPrimary, fontSize: 15.5, fontWeight: "800", marginBottom: 6 },
  p: { color: theme.textSecondary, fontSize: 14, lineHeight: 21 },
  bulletRow: { flexDirection: "row", marginTop: 7, paddingRight: 4 },
  bulletDot: { color: theme.primary, fontSize: 14, lineHeight: 21, width: 16 },
  bulletText: { flex: 1, color: theme.textSecondary, fontSize: 14, lineHeight: 21 },
  footer: { color: theme.textMuted, fontSize: 13, lineHeight: 20, marginTop: 28, fontStyle: "italic" },
});
