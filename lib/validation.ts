const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

export function normalizeHandleText(value: unknown, maxLength = 64) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }
  return value
    .replace(CONTROL_CHARS, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function parseBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

export function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  if (typeof value === "string") {
    return value
      .split(/,|\n/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function parseEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T
) {
  if (typeof value !== "string") {
    return undefined;
  }
  return allowed.includes(value) ? (value as T[number]) : undefined;
}

export function clampInt(value: number | undefined, min: number, max: number) {
  if (value === undefined) {
    return undefined;
  }
  const rounded = Math.round(value);
  if (rounded < min || rounded > max) {
    return undefined;
  }
  return rounded;
}
