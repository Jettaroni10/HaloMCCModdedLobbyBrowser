const normalizeMapName = (value?: string | null) => {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
};

export const REACH_MAP_IMAGE_URL: Record<string, string> = {
  "Boardwalk": "https://www.halopedia.org/File:HaloReach_-_Boardwalk.jpg",
  "Boneyard": "https://www.halopedia.org/File:HaloReach_-_Boneyard.jpg",
  "Countdown": "https://www.halopedia.org/File:HaloReach_-_Countdown.jpg",
  "Powerhouse": "https://www.halopedia.org/File:HaloReach_-_Powerhouse.jpg",
  "Reflection": "https://www.halopedia.org/File:HaloReach_-_Reflection.jpg",
  "Spire": "https://www.halopedia.org/File:HaloReach_-_Spire.jpg",
  "Sword Base": "https://www.halopedia.org/File:HaloReach_-_Sword_Base.jpg",
  "Zealot": "https://www.halopedia.org/File:HaloReach_-_Zealot.jpg",
  "Forge World": "https://www.halopedia.org/File:HaloReach_-_Forge_World.jpg",
  "Asylum": "https://www.halopedia.org/File:HaloReach_-_Asylum.jpg",
  "Hemorrhage": "https://www.halopedia.org/File:HaloReach_-_Hemorrhage.jpg",
  "Paradiso": "https://www.halopedia.org/File:HaloReach_-_Paradiso.jpg",
  "Pinnacle": "https://www.halopedia.org/File:HaloReach_-_Pinnacle.jpg",
  "The Cage": "https://www.halopedia.org/File:HaloReach_-_The_Cage.jpg",
  "Anchor 9": "https://www.halopedia.org/File:HaloReach_-_Anchor_9.jpg",
  "Breakpoint": "https://www.halopedia.org/File:HaloReach_-_Breakpoint.jpg",
  "Tempest": "https://www.halopedia.org/File:HaloReach_-_Tempest.jpg",
  "Condemned": "https://www.halopedia.org/File:HaloReach_-_Condemned.jpg",
  "Highlands": "https://www.halopedia.org/File:HaloReach_-_Highlands.jpg",
  "Battle Canyon": "https://www.halopedia.org/File:HaloReach_-_Battle_Canyon.jpg",
  "Breakneck": "https://www.halopedia.org/File:HaloReach_-_Breakneck.jpg",
  "High Noon": "https://www.halopedia.org/File:HaloReach_-_High_Noon.jpg",
  "Penance": "https://www.halopedia.org/File:HaloReach_-_Penance.jpg",
  "Ridgeline": "https://www.halopedia.org/File:HaloReach_-_Ridgeline.jpg",
  "Solitary": "https://www.halopedia.org/File:HaloReach_-_Solitary.jpg",
};

export const REACH_DEFAULT_BG =
  "https://www.halopedia.org/File:HaloReach_-_Multiplayer.jpg";

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
