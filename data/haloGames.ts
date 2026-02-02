export const HALO_GAMES = [
  { id: "hce", name: "Halo: Combat Evolved" },
  { id: "h2", name: "Halo 2" },
  { id: "h3", name: "Halo 3" },
  { id: "odst", name: "Halo 3: ODST" },
  { id: "reach", name: "Halo: Reach" },
  { id: "h4", name: "Halo 4" },
] as const;

export type HaloGameId = (typeof HALO_GAMES)[number]["id"];
