export function normalizeWorkshopUrl(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname.replace(/^www\./, "");
    if (!host.endsWith("steamcommunity.com")) {
      return { url: raw };
    }
    const id = url.searchParams.get("id");
    if (id) {
      return {
        url: `https://steamcommunity.com/sharedfiles/filedetails/?id=${id}`,
        workshopId: id,
      };
    }
    return { url: raw };
  } catch {
    return null;
  }
}

export function normalizeModName(input: string | null | undefined) {
  const trimmed = (input ?? "").trim();
  return trimmed.length > 0 ? trimmed.slice(0, 120) : "";
}
