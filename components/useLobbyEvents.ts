"use client";

import { useEffect, useRef } from "react";

type LobbyMessageEvent = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderDisplayName: string;
  senderNametagColor?: string | null;
  body: string;
  createdAt: string;
};

type LobbyRosterEvent = {
  lobbyId: string;
};

type LobbyRequestEvent = {
  id: string;
  requesterUserId: string;
  requesterHandleText: string;
  requesterDisplayName: string;
  requesterNametagColor?: string | null;
  createdAt: string;
};

type UseLobbyEventsOptions = {
  lobbyId: string;
  enabled?: boolean;
  onMessageCreated?: (payload: LobbyMessageEvent) => void;
  onRosterUpdated?: (payload: LobbyRosterEvent) => void;
  onRequestCreated?: (payload: LobbyRequestEvent) => void;
};

export function useLobbyEvents({
  lobbyId,
  enabled = true,
  onMessageCreated,
  onRosterUpdated,
  onRequestCreated,
}: UseLobbyEventsOptions) {
  const messageRef = useRef(onMessageCreated);
  const rosterRef = useRef(onRosterUpdated);
  const requestRef = useRef(onRequestCreated);

  useEffect(() => {
    messageRef.current = onMessageCreated;
  }, [onMessageCreated]);

  useEffect(() => {
    rosterRef.current = onRosterUpdated;
  }, [onRosterUpdated]);

  useEffect(() => {
    requestRef.current = onRequestCreated;
  }, [onRequestCreated]);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource(`/api/lobbies/${lobbyId}/events`);

    const handleMessage = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as LobbyMessageEvent;
      messageRef.current?.(payload);
    };

    const handleRoster = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as LobbyRosterEvent;
      rosterRef.current?.(payload);
    };

    const handleRequest = (event: MessageEvent) => {
      const payload = JSON.parse(event.data) as LobbyRequestEvent;
      requestRef.current?.(payload);
    };

    source.addEventListener("message_created", handleMessage);
    source.addEventListener("roster_updated", handleRoster);
    source.addEventListener("request_created", handleRequest);

    return () => {
      source.close();
    };
  }, [enabled, lobbyId]);
}
