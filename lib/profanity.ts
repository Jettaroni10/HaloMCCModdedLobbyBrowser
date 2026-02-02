import profanity from "leo-profanity";

const ALLOWLIST: string[] = [];

if (ALLOWLIST.length > 0) {
  profanity.removeWords(...ALLOWLIST);
}

export function filterProfanity(text: string): string {
  if (!text) return text;
  return profanity.clean(text);
}

export function isOnlyProfanity(
  original: string,
  filtered: string = filterProfanity(original)
) {
  if (!profanity.check(original)) return false;
  const stripped = filtered.replace(/[*\s\W_]+/g, "");
  return stripped.length === 0;
}
