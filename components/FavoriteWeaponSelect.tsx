"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

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
  const selectedLabel = selectedWeapon
    ? `${selectedWeapon.name} · ${gameNameById.get(selectedWeapon.game) ?? selectedWeapon.game}`
    : "Not set";

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={containerRef} className="relative space-y-2">
      <input type="hidden" name={name} value={selectedId} />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2 text-left text-sm text-ink"
      >
        <span className={selectedWeapon ? "text-ink" : "text-ink/60"}>
          {selectedLabel}
        </span>
        <span className="text-xs text-ink/60">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-20 w-full rounded-sm border border-ink/20 bg-sand p-3 shadow-xl">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search weapons"
            className="mb-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          />
          <div className="scrollbar-dark max-h-56 overflow-y-auto rounded-sm border border-ink/10 bg-mist">
            <button
              type="button"
              onClick={() => {
                setSelectedId("");
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/10"
            >
              Not set
            </button>
            {filtered.map((weapon) => (
              <button
                key={weapon.id}
                type="button"
                onClick={() => {
                  setSelectedId(weapon.id);
                  setQuery("");
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink/10 ${
                  weapon.id === selectedId ? "bg-ink/10 text-ink" : "text-ink/80"
                }`}
              >
                <span>{weapon.name}</span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink/50">
                  {gameNameById.get(weapon.game) ?? weapon.game}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/60">
            Selected: {selectedWeapon?.name ?? "Not set"}
          </p>
        </div>
      )}
    </div>
  );
}
