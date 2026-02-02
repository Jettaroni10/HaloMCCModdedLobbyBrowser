const MIN_RANK = 1;
const MAX_RANK = 100;

export function clampRank(rank: unknown): number {
  const value =
    typeof rank === "number"
      ? rank
      : typeof rank === "string"
      ? Number.parseInt(rank, 10)
      : Number.NaN;
  if (!Number.isFinite(value)) {
    return MIN_RANK;
  }
  const floored = Math.floor(value);
  return Math.min(MAX_RANK, Math.max(MIN_RANK, floored));
}

function padRank(rank: number) {
  return String(rank).padStart(3, "0");
}

export function rankToIconSrc(rank: unknown): string {
  const clamped = clampRank(rank);
  return `/ranks/sr${padRank(clamped)}.svg`;
}

export function rankToLabel(rank: unknown): string {
  const clamped = clampRank(rank);
  return `SR${padRank(clamped)}`;
}
