export const HALO_GAMES = [
  { id: "mcc", name: "Halo: The Master Chief Collection" },
  { id: "hce", name: "Halo: Combat Evolved" },
  { id: "hcea", name: "Halo: Combat Evolved Anniversary" },
  { id: "h2", name: "Halo 2" },
  { id: "h2a", name: "Halo 2: Anniversary" },
  { id: "h3", name: "Halo 3" },
  { id: "odst", name: "Halo 3: ODST" },
  { id: "reach", name: "Halo: Reach" },
  { id: "h4", name: "Halo 4" },
  { id: "h5", name: "Halo 5: Guardians" },
  { id: "infinite", name: "Halo Infinite" },
  { id: "wars", name: "Halo Wars" },
  { id: "wars2", name: "Halo Wars 2" },
  { id: "spartan_assault", name: "Halo: Spartan Assault" },
  { id: "spartan_strike", name: "Halo: Spartan Strike" },
  { id: "fireteam_raven", name: "Halo: Fireteam Raven" },
] as const;

export type HaloGameId = (typeof HALO_GAMES)[number]["id"];
