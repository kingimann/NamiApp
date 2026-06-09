import { theme } from "@/src/theme";

// Curated accent palette users can pick from to theme their profile. They can
// also enter any custom #RRGGBB hex (validated server-side).
export const ACCENT_COLORS = [
  "#7C3AED", // violet
  "#2563EB", // blue
  "#0EA5E9", // sky
  "#06B6D4", // cyan
  "#14B8A6", // teal
  "#10B981", // emerald
  "#22C55E", // green
  "#84CC16", // lime
  "#EAB308", // amber
  "#F59E0B", // gold
  "#F97316", // orange
  "#EF4444", // red
  "#F43F5E", // rose
  "#EC4899", // pink
  "#D946EF", // fuchsia
  "#8B5CF6", // purple
  "#6366F1", // indigo
  "#64748B", // slate
  "#0F766E", // deep teal
  "#B45309", // bronze
];

// One-tap theme bundles: apply a coordinated accent + background + frame.
export type ThemePreset = {
  key: string; label: string; accent: string; background: string; frame: string;
};
export const THEME_PRESETS: ThemePreset[] = [
  { key: "default", label: "Default", accent: "", background: "default", frame: "none" },
  { key: "midnight", label: "Midnight", accent: "#6366F1", background: "midnight", frame: "sapphire" },
  { key: "sunset", label: "Sunset", accent: "#F97316", background: "sunset", frame: "molten" },
  { key: "emerald", label: "Emerald", accent: "#10B981", background: "emerald", frame: "emerald" },
  { key: "rose", label: "Rosé", accent: "#F43F5E", background: "rosewood", frame: "ruby" },
  { key: "ocean", label: "Ocean", accent: "#06B6D4", background: "ocean", frame: "ocean" },
  { key: "nebula", label: "Nebula", accent: "#A855F7", background: "nebula", frame: "amethyst" },
  { key: "carbon", label: "Carbon", accent: "#A1A1AA", background: "carbon", frame: "mono" },
];

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Validate a hex color; fall back to the app's primary when unset/invalid.
export function resolveAccent(color?: string | null): string {
  return color && HEX_RE.test(color) ? color : theme.primary;
}

export function isValidHex(color: string): boolean {
  return HEX_RE.test(color.trim());
}

// Build a pleasant 3-stop gradient from a single accent for the cover banner.
export function accentGradient(color?: string | null): [string, string, string] {
  const c = resolveAccent(color);
  return [shade(c, 28), c, shade(c, -22)];
}

// Lighten (positive amt) or darken (negative amt) a #RRGGBB hex by a percentage.
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 0xff) + (amt / 100) * 255);
  const g = clamp(((n >> 8) & 0xff) + (amt / 100) * 255);
  const b = clamp((n & 0xff) + (amt / 100) * 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// ── Steam-style avatar frames ────────────────────────────────────────────
// Decorative gradient rings drawn around the avatar. `colors` feeds a
// LinearGradient; an empty list means "no frame".
export type AvatarFrame = { key: string; label: string; colors: string[] };
export const AVATAR_FRAMES: AvatarFrame[] = [
  { key: "none", label: "None", colors: [] },
  { key: "gold", label: "Gold", colors: ["#FDE68A", "#F59E0B", "#B45309"] },
  { key: "emerald", label: "Emerald", colors: ["#6EE7B7", "#10B981", "#065F46"] },
  { key: "ruby", label: "Ruby", colors: ["#FDA4AF", "#F43F5E", "#9F1239"] },
  { key: "sapphire", label: "Sapphire", colors: ["#93C5FD", "#3B82F6", "#1E3A8A"] },
  { key: "amethyst", label: "Amethyst", colors: ["#D8B4FE", "#A855F7", "#6B21A8"] },
  { key: "rgb", label: "RGB", colors: ["#F43F5E", "#EAB308", "#22C55E", "#3B82F6", "#A855F7"] },
  { key: "frost", label: "Frost", colors: ["#E0F2FE", "#7DD3FC", "#38BDF8"] },
  { key: "molten", label: "Molten", colors: ["#FDBA74", "#F97316", "#DC2626"] },
  { key: "mono", label: "Mono", colors: ["#F4F4F5", "#A1A1AA", "#52525B"] },
  { key: "ocean", label: "Ocean", colors: ["#67E8F9", "#22D3EE", "#0E7490"] },
  { key: "rose", label: "Rose", colors: ["#FECDD3", "#FB7185", "#BE123C"] },
  { key: "sunset", label: "Sunset", colors: ["#FDE68A", "#FB923C", "#DB2777"] },
  { key: "lime", label: "Lime", colors: ["#D9F99D", "#84CC16", "#3F6212"] },
  { key: "midnight", label: "Midnight", colors: ["#818CF8", "#4F46E5", "#1E1B4B"] },
];
const FRAME_KEYS = new Set(AVATAR_FRAMES.map((f) => f.key));
export function isValidFrame(key?: string | null): boolean {
  return !!key && FRAME_KEYS.has(key);
}
export function frameColors(key?: string | null): string[] {
  const f = AVATAR_FRAMES.find((x) => x.key === key);
  return f ? f.colors : [];
}

// ── Steam-style full-profile backgrounds ─────────────────────────────────
// A themed gradient painted behind the whole profile. "default" = app bg.
export type ProfileBackground = { key: string; label: string; colors: string[] };
export const PROFILE_BACKGROUNDS: ProfileBackground[] = [
  { key: "default", label: "Default", colors: [] },
  { key: "midnight", label: "Midnight", colors: ["#0F172A", "#1E1B4B", "#0B1020"] },
  { key: "sunset", label: "Sunset", colors: ["#1F2937", "#7C2D12", "#451A03"] },
  { key: "aurora", label: "Aurora", colors: ["#042F2E", "#134E4A", "#1E3A8A"] },
  { key: "crimson", label: "Crimson", colors: ["#1C0A0A", "#3F1212", "#7F1D1D"] },
  { key: "forest", label: "Forest", colors: ["#0A1F14", "#14342B", "#052E16"] },
  { key: "nebula", label: "Nebula", colors: ["#1A0B2E", "#3B0764", "#172554"] },
  { key: "carbon", label: "Carbon", colors: ["#09090B", "#18181B", "#27272A"] },
  { key: "ocean", label: "Ocean", colors: ["#082F49", "#0C4A6E", "#155E75"] },
  { key: "rosewood", label: "Rosewood", colors: ["#1F1115", "#4C0519", "#831843"] },
  { key: "dusk", label: "Dusk", colors: ["#1E1B4B", "#4C1D95", "#831843"] },
  { key: "slate", label: "Slate", colors: ["#0F172A", "#1E293B", "#334155"] },
  { key: "emerald", label: "Emerald", colors: ["#022C22", "#064E3B", "#065F46"] },
];
const BG_KEYS = new Set(PROFILE_BACKGROUNDS.map((b) => b.key));
export function isValidBackground(key?: string | null): boolean {
  return !!key && BG_KEYS.has(key);
}
export function backgroundColors(key?: string | null): string[] {
  const b = PROFILE_BACKGROUNDS.find((x) => x.key === key);
  return b ? b.colors : [];
}

// Normalize a user-typed URL into something openable (adds https:// if missing).
export function normalizeLinkUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// A short, display-friendly version of a URL (drops scheme + trailing slash).
export function prettyLinkLabel(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
