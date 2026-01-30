export const Games = ["H1", "H2", "H3", "ODST", "REACH", "H4"] as const;

export type Game = (typeof Games)[number];

export const Regions = ["NA", "EU", "OCE", "SA", "AS"] as const;

export type Region = (typeof Regions)[number];

export const Platforms = ["STEAM", "XBOX_FUTURE"] as const;

export type Platform = (typeof Platforms)[number];

export const Voices = ["MIC_REQUIRED", "MIC_OPTIONAL", "NO_MIC"] as const;

export type Voice = (typeof Voices)[number];

export const Vibes = ["CASUAL", "SWEATY", "CHAOS", "RP", "OTHER"] as const;

export type Vibe = (typeof Vibes)[number];

export const JoinRequestStatuses = ["PENDING", "ACCEPTED", "DECLINED"] as const;

export type JoinRequestStatus = (typeof JoinRequestStatuses)[number];
