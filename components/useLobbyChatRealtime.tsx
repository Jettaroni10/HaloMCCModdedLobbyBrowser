"use client";

import { useCallback, useEffect, useRef } from "react";
import { createLobbyRealtimeClient } from "@/lib/realtime/ablyClient";

type MessagePayload = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderGamertag: string;
  senderNametagColor?: string | null;
  senderSrLevel?: number | null;
  body: string;
  createdAt: string;
};

type TypingPayload = {
  userId: string;
  gamertag: string;
};

type UseLobbyChatRealtimeOptions = {
  lobbyId: string;
  enabled?: boolean;
  onMessage?: (message: MessagePayload) => void;
  onTypingStart?: (payload: TypingPayload) => void;
  onTypingStop?: (payload: TypingPayload) => void;
};

const MESSAGE_BODY_LIMIT = 500;

function isMessagePayload(payload: unknown): payload is MessagePayload {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as MessagePayload;
  return (
    typeof data.id === "string" &&
    typeof data.conversationId === "string" &&
    typeof data.senderUserId === "string" &&
    typeof data.senderGamertag === "string" &&
    typeof data.body === "string" &&
    data.body.length <= MESSAGE_BODY_LIMIT &&
    typeof data.createdAt === "string"
  );
}

function isTypingPayload(payload: unknown): payload is TypingPayload {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as TypingPayload;
  return typeof data.userId === "string" && typeof data.gamertag === "string";
}

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
  const channelRef = useRef<ReturnType<
    ReturnType<typeof createLobbyRealtimeClient>["channels"]["get"]
  > | null>(null);
  const clientRef = useRef<ReturnType<typeof createLobbyRealtimeClient> | null>(
    null
  );
  const closedRef = useRef(false);

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
    if (!lobbyId) return;
    closedRef.current = false;
    const client = createLobbyRealtimeClient(lobbyId);
    clientRef.current = client;
    const channel = client.channels.get(`lobby:${lobbyId}`);
    const typingChannel = client.channels.get(`lobby:${lobbyId}:typing`);
    channelRef.current = channel;

    const handleMessage = (message: { name?: string; data?: unknown }) => {
      if (message.name !== "message:new") return;
      if (!isMessagePayload(message.data)) return;
      messageRef.current?.(message.data);
    };
    const handleTypingStart = (message: { name?: string; data?: unknown }) => {
      if (message.name !== "typing:start") return;
      if (!isTypingPayload(message.data)) return;
      typingStartRef.current?.(message.data);
    };
    const handleTypingStop = (message: { name?: string; data?: unknown }) => {
      if (message.name !== "typing:stop") return;
      if (!isTypingPayload(message.data)) return;
      typingStopRef.current?.(message.data);
    };

    const safeSubscribe = (
      fn: () => void | Promise<unknown>,
      label: string
    ) => {
      try {
        const result = fn();
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((error) => {
            console.warn("Ably subscribe failed", {
              lobbyId,
              label,
              error: error instanceof Error ? error.message : String(error),
            });
          });
        }
      } catch (error) {
        console.warn("Ably subscribe failed", {
          lobbyId,
          label,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    safeSubscribe(() => channel.subscribe(handleMessage), "message");
    safeSubscribe(() => typingChannel.subscribe(handleTypingStart), "typing:start");
    safeSubscribe(() => typingChannel.subscribe(handleTypingStop), "typing:stop");

    return () => {
      try {
        channel.unsubscribe();
        typingChannel.unsubscribe();
      } catch {
        // ignore
      }
      channelRef.current = null;
      if (!closedRef.current) {
        closedRef.current = true;
        Promise.resolve()
          .then(() => {
            client.close();
          })
          .catch(() => {});
      }
      clientRef.current = null;
    };
  }, [enabled, lobbyId]);

  const publishTyping = useCallback(
    async (state: "start" | "stop", payload: TypingPayload) => {
      const client = clientRef.current;
      if (!client) return;
      const event = state === "start" ? "typing:start" : "typing:stop";
      try {
        await client.channels
          .get(`lobby:${lobbyId}:typing`)
          .publish(event, payload);
      } catch (error) {
        console.warn("Ably typing publish failed", {
          lobbyId,
          event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [lobbyId]
  );

  return { publishTyping };
}
