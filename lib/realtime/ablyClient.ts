"use client";

import Ably from "ably";

export function createLobbyRealtimeClient(lobbyId: string) {
  return new Ably.Realtime({
    authUrl: `/api/realtime/auth?lobbyId=${encodeURIComponent(lobbyId)}`,
    authMethod: "POST",
  });
}
