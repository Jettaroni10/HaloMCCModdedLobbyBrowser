const normalizeMapName = (value?: string | null) => {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
};

export const REACH_MAP_IMAGE_URL: Record<string, string> = {
  "Boardwalk": "/maps/reach/boardwalk.jpg",
  "Boneyard": "/maps/reach/boneyard.jpg",
  "Countdown": "/maps/reach/countdown.jpg",
  "Powerhouse": "/maps/reach/powerhouse.jpg",
  "Reflection": "/maps/reach/reflection.jpg",
  "Spire": "/maps/reach/spire.jpg",
  "Sword Base": "/maps/reach/sword-base.jpg",
  "Zealot": "/maps/reach/zealot.jpg",
  "Forge World": "/maps/reach/forge-world.png",
  "Asylum": "/maps/reach/asylum.jpg",
  "Hemorrhage": "/maps/reach/hemorrhage.png",
  "Paradiso": "/maps/reach/paradiso.jpg",
  "Pinnacle": "/maps/reach/pinnacle.jpg",
  "The Cage": "/maps/reach/the-cage.jpg",
  "Anchor 9": "/maps/reach/anchor-9.png",
  "Breakpoint": "/maps/reach/breakpoint.png",
  "Tempest": "/maps/reach/tempest.png",
  "Condemned": "/maps/reach/condemned.png",
  "Highlands": "/maps/reach/highlands.png",
  "Battle Canyon": "/maps/reach/battle-canyon.png",
  "Breakneck": "/maps/reach/breakneck.png",
  "High Noon": "/maps/reach/high-noon.png",
  "Penance": "/maps/reach/penance.png",
  "Ridgeline": "/maps/reach/ridgeline.png",
  "Solitary": "/maps/reach/solitary.png",
};

export const REACH_DEFAULT_BG =
  "/maps/reach/halo-reach-multiplayer.jpg";

const REACH_MAP_IMAGE_URL_NORMALIZED = Object.entries(REACH_MAP_IMAGE_URL).reduce<
  Record<string, string>
>((acc, [key, value]) => {
  acc[normalizeMapName(key)] = value;
  return acc;
}, {});

export function getLobbyBgImage({
  customImageUrl,
  telemetryMapName,
  fallbackMapName,
}: {
  customImageUrl?: string | null;
  telemetryMapName?: string | null;
  fallbackMapName?: string | null;
}) {
  if (customImageUrl) {
    return customImageUrl;
  }

  const mapName = telemetryMapName || fallbackMapName || "";
  const normalized = normalizeMapName(mapName);
  if (normalized && REACH_MAP_IMAGE_URL_NORMALIZED[normalized]) {
    return REACH_MAP_IMAGE_URL_NORMALIZED[normalized];
  }

  return REACH_DEFAULT_BG;
}
