"use client";

import { useState } from "react";
import LobbyRoster from "./LobbyRoster";
import { useLobbyEvents } from "./useLobbyEvents";

type RosterMember = {
  slotNumber: number;
  displayName: string;
  srLevel: number;
  userId: string;
  nametagColor?: string | null;
};

type LobbyRosterLiveProps = {
  lobbyId: string;
  initialRoster: RosterMember[];
  viewerUserId?: string | null;
  friendIds?: string[];
  pendingIds?: string[];
};

export default function LobbyRosterLive({
  lobbyId,
  initialRoster,
  viewerUserId,
  friendIds = [],
  pendingIds = [],
}: LobbyRosterLiveProps) {
  const [roster, setRoster] = useState<RosterMember[]>(initialRoster);

  useLobbyEvents({
    lobbyId,
    onRosterUpdated: async () => {
      const response = await fetch(`/api/lobbies/${lobbyId}/roster`);
      if (!response.ok) return;
      const data = (await response.json()) as RosterMember[];
      setRoster(data);
    },
  });

  return (
    <LobbyRoster
      roster={roster}
      viewerUserId={viewerUserId}
      friendIds={friendIds}
      pendingIds={pendingIds}
    />
  );
}
