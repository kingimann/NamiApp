/**
 * Ready-made profile avatars from DiceBear's public API (PNG, no key) —
 * deterministic per (style, seed), so every avatar is stable and shareable.
 *
 * The picker exposes many art styles and can shuffle to generate fresh seeds,
 * giving effectively unlimited avatar options without uploading a photo.
 */
export type AvatarStyle = { key: string; label: string };

// DiceBear 7.x styles, labelled for the picker.
export const AVATAR_STYLES: AvatarStyle[] = [
  { key: "avataaars", label: "Cartoon" },
  { key: "adventurer", label: "Adventurer" },
  { key: "big-smile", label: "Big Smile" },
  { key: "fun-emoji", label: "Emoji" },
  { key: "bottts", label: "Robots" },
  { key: "micah", label: "Micah" },
  { key: "lorelei", label: "Lorelei" },
  { key: "notionists", label: "Notion" },
  { key: "open-peeps", label: "Peeps" },
  { key: "personas", label: "Personas" },
  { key: "pixel-art", label: "Pixel" },
  { key: "thumbs", label: "Thumbs" },
  { key: "shapes", label: "Shapes" },
  { key: "identicon", label: "Identicon" },
];

// A base pool of human-friendly seeds; shuffling salts these for new looks.
const SEEDS = [
  "Nova", "Leo", "Mia", "Zoe", "Max", "Ivy", "Kai", "Sam",
  "Ada", "Rex", "Luna", "Finn", "Ruby", "Ezra", "Nina", "Theo",
  "Cleo", "Otis", "Wren", "Hugo", "Lola", "Milo", "Suki", "Jax",
  "Beau", "Iris", "Cody", "Vera", "Remy", "Posy", "Dash", "Echo",
];

export function avatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/7.x/${style}/png?seed=${encodeURIComponent(seed)}`;
}

// Generate `count` avatars for a style. `salt` (bumped by a Shuffle button)
// deterministically rerolls the seeds so users can keep discovering new ones.
export function avatarsForStyle(style: string, count = 24, salt = 0): string[] {
  return Array.from({ length: count }, (_, i) => {
    const base = SEEDS[(i + salt * 7) % SEEDS.length];
    const seed = salt === 0 ? base : `${base}-${salt}-${i}`;
    return avatarUrl(style, seed);
  });
}

// Back-compat: a small default gallery (one per style) used elsewhere.
export const DEFAULT_AVATARS: string[] = AVATAR_STYLES.map(
  (s, i) => avatarUrl(s.key, SEEDS[i % SEEDS.length]),
);
