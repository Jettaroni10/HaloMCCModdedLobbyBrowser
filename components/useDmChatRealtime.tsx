"use client";

import { useCallback, useEffect, useRef } from "react";
import { createDmRealtimeClient } from "@/lib/realtime/ablyClient";

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

type UseDmChatRealtimeOptions = {
  conversationId: string;
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
    typeof data.senderDisplayName === "string" &&
    typeof data.body === "string" &&
    data.body.length <= MESSAGE_BODY_LIMIT &&
    typeof data.createdAt === "string"
  );
}

function isTypingPayload(payload: unknown): payload is TypingPayload {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as TypingPayload;
  return typeof data.userId === "string" && typeof data.displayName === "string";
}

export function useDmChatRealtime({
  conversationId,
  enabled = true,
  onMessage,
  onTypingStart,
  onTypingStop,
}: UseDmChatRealtimeOptions) {
  const messageRef = useRef(onMessage);
  const typingStartRef = useRef(onTypingStart);
  const typingStopRef = useRef(onTypingStop);
  const clientRef = useRef<ReturnType<typeof createDmRealtimeClient> | null>(
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
    if (!conversationId) return;
    closedRef.current = false;
    const client = createDmRealtimeClient(conversationId);
    clientRef.current = client;
    const channel = client.channels.get(`dm:${conversationId}`);
    const typingChannel = client.channels.get(`dm:${conversationId}:typing`);

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

    try {
      channel.subscribe(handleMessage);
      typingChannel.subscribe(handleTypingStart);
      typingChannel.subscribe(handleTypingStop);
    } catch (error) {
      console.warn("Ably DM subscribe failed", {
        conversationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return () => {
      try {
        channel.unsubscribe();
        typingChannel.unsubscribe();
      } catch {
        // ignore
      }
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
  }, [enabled, conversationId]);

  const publishTyping = useCallback(
    async (state: "start" | "stop", payload: TypingPayload) => {
      const client = clientRef.current;
      if (!client) return;
      const event = state === "start" ? "typing:start" : "typing:stop";
      try {
        await client.channels
          .get(`dm:${conversationId}:typing`)
          .publish(event, payload);
      } catch (error) {
        console.warn("Ably DM typing publish failed", {
          conversationId,
          event,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [conversationId]
  );

  return { publishTyping };
}
