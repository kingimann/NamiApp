// Mirrors backend core.POINTS_TIERS so the client can show the current level,
// title, and progress toward the next tier without an extra request.
export const POINTS_TIERS: { min: number; title: string }[] = [
  { min: 0, title: "Newcomer" },
  { min: 50, title: "Explorer" },
  { min: 150, title: "Regular" },
  { min: 400, title: "Insider" },
  { min: 900, title: "Star" },
  { min: 2000, title: "Influencer" },
  { min: 5000, title: "Icon" },
  { min: 12000, title: "Legend" },
  { min: 30000, title: "Mythic" },
];

export type LevelInfo = {
  level: number;
  title: string;
  currentFloor: number;
  nextFloor: number | null;
  /** 0..1 progress to the next tier (1 at max level). */
  progress: number;
  toNext: number; // points remaining to next tier (0 at max)
  maxLevel: boolean;
};

export function levelInfo(points: number): LevelInfo {
  const p = Math.max(0, Math.floor(points || 0));
  let level = 1;
  let title = POINTS_TIERS[0].title;
  let currentFloor = 0;
  for (let i = 0; i < POINTS_TIERS.length; i++) {
    if (p >= POINTS_TIERS[i].min) {
      level = i + 1;
      title = POINTS_TIERS[i].title;
      currentFloor = POINTS_TIERS[i].min;
    } else break;
  }
  const maxLevel = level >= POINTS_TIERS.length;
  const nextFloor = maxLevel ? null : POINTS_TIERS[level].min;
  const span = nextFloor === null ? 1 : nextFloor - currentFloor;
  const progress = nextFloor === null ? 1 : Math.min(1, Math.max(0, (p - currentFloor) / span));
  const toNext = nextFloor === null ? 0 : Math.max(0, nextFloor - p);
  return { level, title, currentFloor, nextFloor, progress, toNext, maxLevel };
}
