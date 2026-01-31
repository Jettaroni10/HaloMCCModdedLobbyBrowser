"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Types } from "ably";
import { createLobbyRealtimeClient } from "@/lib/realtime/ablyClient";

type MessagePayload = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderDisplayName: string;
  senderNametagColor?: string | null;
  body: string;
  createdAt: string;
};

type TypingPayload = {
  userId: string;
  displayName: string;
};

type UseLobbyChatRealtimeOptions = {
  lobbyId: string;
  enabled?: boolean;
  onMessage?: (message: MessagePayload) => void;
  onTypingStart?: (payload: TypingPayload) => void;
  onTypingStop?: (payload: TypingPayload) => void;
};

// Findings:
// - Chat messages were rendered from server-fetched data only, so UI stayed stale.
// - SSE relied on in-memory events, which don't propagate across Netlify functions.
// - Realtime needs a managed provider; Ably is used for cross-instance delivery.
export function useLobbyChatRealtime({
  lobbyId,
  enabled = true,
  onMessage,
  onTypingStart,
  onTypingStop,
}: UseLobbyChatRealtimeOptions) {
  const messageRef = useRef(onMessage);
  const typingStartRef = useRef(onTypingStart);
  const typingStopRef = useRef(onTypingStop);
  const channelRef = useRef<Types.RealtimeChannelCallbacks | null>(null);
  const clientRef = useRef<ReturnType<typeof createLobbyRealtimeClient> | null>(
    null
  );

  useEffect(() => {
    messageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    typingStartRef.current = onTypingStart;
  }, [onTypingStart]);

  useEffect(() => {
    typingStopRef.current = onTypingStop;
  }, [onTypingStop]);

  useEffect(() => {
    if (!enabled) return;
    const client = createLobbyRealtimeClient(lobbyId);
    clientRef.current = client;
    const channel = client.channels.get(`lobby:${lobbyId}`);
    channelRef.current = channel;

    const handleMessage = (message: Types.Message) => {
      messageRef.current?.(message.data as MessagePayload);
    };
    const handleTypingStart = (message: Types.Message) => {
      typingStartRef.current?.(message.data as TypingPayload);
    };
    const handleTypingStop = (message: Types.Message) => {
      typingStopRef.current?.(message.data as TypingPayload);
    };

    channel.subscribe("message:new", handleMessage);
    channel.subscribe("typing:start", handleTypingStart);
    channel.subscribe("typing:stop", handleTypingStop);

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      client.close();
      clientRef.current = null;
    };
  }, [enabled, lobbyId]);

  const publishTyping = useCallback(
    async (state: "start" | "stop", payload: TypingPayload) => {
      const channel = channelRef.current;
      if (!channel) return;
      const event = state === "start" ? "typing:start" : "typing:stop";
      await channel.publish(event, payload);
    },
    []
  );

  return { publishTyping };
}
