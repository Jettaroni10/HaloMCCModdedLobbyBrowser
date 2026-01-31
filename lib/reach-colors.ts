export const ReachColors = [
  { name: "Snow", hex: "#D9D9D6" },
  { name: "Silver", hex: "#A8A9AD" },
  { name: "Steel", hex: "#6F767D" },
  { name: "Slate", hex: "#3F454C" },
  { name: "Khaki", hex: "#8A7F67" },
  { name: "Sand", hex: "#A09173" },
  { name: "Tan", hex: "#8B6E4B" },
  { name: "Brown", hex: "#4A3728" },
  { name: "Olive", hex: "#4B5A3C" },
  { name: "Sage", hex: "#5E6B53" },
  { name: "Forest", hex: "#2F4B3A" },
  { name: "Teal", hex: "#2E6A64" },
  { name: "Cobalt", hex: "#2D4F8C" },
  { name: "Navy", hex: "#1F2F4A" },
  { name: "Purple", hex: "#4A3E63" },
  { name: "Maroon", hex: "#5B2B2E" },
  { name: "Brick", hex: "#7A3B2F" },
  { name: "Rust", hex: "#8A4A2A" },
  { name: "Orange", hex: "#B56A2B" },
  { name: "Gold", hex: "#B59B3A" },
  { name: "Yellow", hex: "#B8B04A" },
  { name: "Crimson", hex: "#8B2F2F" },
  { name: "Red", hex: "#A33A3A" },
  { name: "Cyan", hex: "#3B8E9A" },
  { name: "Pink", hex: "#A05C7A" },
] as const;

export type ReachColorHex = (typeof ReachColors)[number]["hex"];

export const DEFAULT_NAMETAG_COLOR = "#D9D9D6";

export const ReachColorHexes = ReachColors.map((color) => color.hex);

const ReachColorSet = new Set<string>(ReachColorHexes);

export function isReachColor(value?: string | null): value is ReachColorHex {
  if (!value) return false;
  return ReachColorSet.has(value);
}

export function resolveNametagColor(value?: string | null) {
  return isReachColor(value) ? value : DEFAULT_NAMETAG_COLOR;
}

export function nameplateTextColor(hex?: string | null) {
  const value = resolveNametagColor(hex).replace("#", "");
  if (value.length !== 6) {
    return "#FFFFFF";
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 170 ? "#0B0F14" : "#FFFFFF";
}
