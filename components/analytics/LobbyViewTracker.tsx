"use client";

import { useEffect } from "react";
import { hashId, trackEvent } from "@/lib/analytics";

type LobbyViewTrackerProps = {
  lobbyId: string;
  game: string;
  isModded: boolean;
  modCount: number;
};

export default function LobbyViewTracker({
  lobbyId,
  game,
  isModded,
  modCount,
}: LobbyViewTrackerProps) {
  useEffect(() => {
    trackEvent("lobby_viewed", {
      lobby_id: hashId(lobbyId),
      game,
      is_modded: isModded,
      mod_count: modCount,
    });
  }, [game, isModded, lobbyId, modCount]);

  return null;
}
