"use client";

import { useMemo, useState } from "react";
import { HALO_WEAPONS } from "@/data/haloWeapons";
import { HALO_GAMES } from "@/data/haloGames";

type FavoriteWeaponSelectProps = {
  name?: string;
  defaultValue?: string | null;
};

const gameNameById = new Map(HALO_GAMES.map((game) => [game.id, game.name]));

export default function FavoriteWeaponSelect({
  name = "favoriteWeaponId",
  defaultValue,
}: FavoriteWeaponSelectProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(defaultValue ?? "");

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return HALO_WEAPONS;
    return HALO_WEAPONS.filter((weapon) => {
      const gameName = gameNameById.get(weapon.game) ?? weapon.game;
      return (
        weapon.name.toLowerCase().includes(trimmed) ||
        gameName.toLowerCase().includes(trimmed) ||
        weapon.game.toLowerCase().includes(trimmed)
      );
    });
  }, [query]);

  const selectedWeapon = HALO_WEAPONS.find((weapon) => weapon.id === selectedId);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={selectedId} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search weapons"
        className="w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
      />
      <select
        value={selectedId}
        onChange={(event) => setSelectedId(event.target.value)}
        size={6}
        className="w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
      >
        <option value="">Not set</option>
        {filtered.map((weapon) => (
          <option key={weapon.id} value={weapon.id}>
            {weapon.name} · {gameNameById.get(weapon.game) ?? weapon.game}
          </option>
        ))}
      </select>
      <p className="text-xs text-ink/60">
        Selected: {selectedWeapon?.name ?? "Not set"}
      </p>
    </div>
  );
}
