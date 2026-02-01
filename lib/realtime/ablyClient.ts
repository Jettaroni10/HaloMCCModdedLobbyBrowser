"use client";

import Ably from "ably";

export function createLobbyRealtimeClient(lobbyId: string) {
  return new Ably.Realtime({
    authUrl: `/api/realtime/auth?lobbyId=${encodeURIComponent(lobbyId)}`,
    authMethod: "POST",
  });
}

export function createHostRealtimeClient() {
  return new Ably.Realtime({
    authUrl: `/api/realtime/auth`,
    authMethod: "POST",
  });
}

export function createDmRealtimeClient(conversationId: string) {
  return new Ably.Realtime({
    authUrl: `/api/realtime/auth?dmId=${encodeURIComponent(conversationId)}`,
    authMethod: "POST",
  });
}
