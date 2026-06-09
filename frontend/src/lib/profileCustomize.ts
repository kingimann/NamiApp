import { theme } from "@/src/theme";

// Curated accent palette users can pick from to theme their profile. They can
// also enter any custom #RRGGBB hex (validated server-side).
export const ACCENT_COLORS = [
  "#7C3AED", // violet
  "#2563EB", // blue
  "#0EA5E9", // sky
  "#14B8A6", // teal
  "#22C55E", // green
  "#EAB308", // amber
  "#F97316", // orange
  "#EF4444", // red
  "#EC4899", // pink
  "#8B5CF6", // purple
  "#64748B", // slate
  "#0F766E", // deep teal
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
