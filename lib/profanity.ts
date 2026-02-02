import profanity from "leo-profanity";

const ALLOWLIST: string[] = [];

profanity.loadDictionary("en");
if (ALLOWLIST.length > 0) {
  profanity.remove(ALLOWLIST);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function filterProfanity(input: string): string {
  if (!input) return input;
  let output = input;
  const badWords = profanity.list();

  for (const word of badWords) {
    const escaped = escapeRegExp(word);
    const regex = new RegExp(`\\b${escaped}\\w*\\b`, "gi");
    output = output.replace(regex, (match) => "*".repeat(match.length));
  }

  return output;
}
