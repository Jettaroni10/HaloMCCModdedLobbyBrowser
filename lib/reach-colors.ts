export const ReachColors = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#FE0000" },
  { name: "Blue", hex: "#0201E3" },
  { name: "Gray", hex: "#707E71" },
  { name: "Yellow", hex: "#FFFF01" },
  { name: "Green", hex: "#00FF01" },
  { name: "Pink", hex: "#FF56B9" },
  { name: "Purple", hex: "#AB10F4" },
  { name: "Cyan", hex: "#01FFFF" },
  { name: "Cobalt", hex: "#6493ED" },
  { name: "Orange", hex: "#FF7F00" },
  { name: "Teal", hex: "#1ECC91" },
  { name: "Sage", hex: "#006401" },
  { name: "Brown", hex: "#603814" },
  { name: "Tan", hex: "#C69C6C" },
  { name: "Maroon", hex: "#9D0B0E" },
  { name: "Salmon", hex: "#F5999E" },
] as const;

export type ReachColorHex = (typeof ReachColors)[number]["hex"];

export const DEFAULT_NAMETAG_COLOR = "#FFFFFF";

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
