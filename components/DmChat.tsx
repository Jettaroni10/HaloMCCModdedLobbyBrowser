"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveNametagColor } from "@/lib/reach-colors";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { rankToLabel } from "@/lib/ranks";
import { useDmChatRealtime } from "./useDmChatRealtime";
import GamertagLink from "@/components/GamertagLink";

type ChatMessage = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderGamertag: string;
  senderNametagColor?: string | null;
  senderSrLevel?: number | null;
  body: string;
  createdAt: string;
  status?: "sending" | "failed" | "sent";
};

type DmChatProps = {
  targetUserId: string;
  conversationId: string;
  viewerId: string;
  viewerGamertag: string;
  viewerSrLevel?: number | null;
  initialMessages: ChatMessage[];
  targetGamertag: string;
  targetNametagColor?: string | null;
  targetSrLevel?: number | null;
};

export default function DmChat({
  targetUserId,
  conversationId,
  viewerId,
  viewerGamertag,
  viewerSrLevel,
  initialMessages,
  targetGamertag,
  targetNametagColor,
  targetSrLevel,
}: DmChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [ui, setUi] = useState({ body: "", error: "", sending: false });
  const [hydrated, setHydrated] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const typingActive = useRef(false);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    return () => {
      typingTimers.current.forEach((timer) => clearTimeout(timer));
      typingTimers.current.clear();
      if (typingStopTimer.current) {
        clearTimeout(typingStopTimer.current);
      }
    };
  }, []);

  const { publishTyping } = useDmChatRealtime({
    conversationId,
    onMessage: (message) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        const tempIndex = prev.findIndex(
          (item) =>
            item.senderUserId === viewerId &&
            item.status === "sending" &&
            item.body === message.body
        );
        if (tempIndex >= 0) {
          const next = [...prev];
          next[tempIndex] = { ...message, status: "sent" };
          return next;
        }
        if (message.senderUserId === viewerId) {
          const fallbackIndex = prev.findIndex(
            (item) => item.senderUserId === viewerId && item.status === "sending"
          );
          if (fallbackIndex >= 0) {
            const next = [...prev];
            next[fallbackIndex] = { ...message, status: "sent" };
            return next;
          }
        }
        return [...prev, message];
      });
    },
    onTypingStart: (payload) => {
      if (payload.userId === viewerId) return;
      setTypingUsers((prev) => ({
        ...prev,
        [payload.userId]: payload.gamertag,
      }));
      const existing = typingTimers.current.get(payload.userId);
      if (existing) clearTimeout(existing);
      typingTimers.current.set(
        payload.userId,
        setTimeout(() => {
          setTypingUsers((prev) => {
            const next = { ...prev };
            delete next[payload.userId];
            return next;
          });
        }, 2000)
      );
    },
    onTypingStop: (payload) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
      const existing = typingTimers.current.get(payload.userId);
      if (existing) clearTimeout(existing);
    },
  });

  const loadMessages = useCallback(async () => {
    const response = await fetch(`/api/dm/${targetUserId}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as
      | { messages?: ChatMessage[] }
      | null;
    if (!Array.isArray(data?.messages)) return;
    setMessages(data.messages);
    requestAnimationFrame(scrollToBottom);
  }, [targetUserId]);

  useEffect(() => {
    let active = true;
    const safeLoad = async () => {
      if (!active) return;
      await loadMessages();
    };
    void safeLoad();
    const interval = setInterval(safeLoad, 15000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [loadMessages]);

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages.length, scrollToBottom]);

  async function handleSend(
    event: React.FormEvent<HTMLFormElement>,
    overrideBody?: string
  ) {
    event.preventDefault();
    const trimmed = (overrideBody ?? ui.body).trim();
    if (!trimmed) return;
    if (typingStopTimer.current) {
      clearTimeout(typingStopTimer.current);
    }
    if (typingActive.current) {
      typingActive.current = false;
      void publishTyping("stop", {
        userId: viewerId,
        gamertag: viewerGamertag,
      });
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId,
      senderUserId: viewerId,
      senderGamertag: viewerGamertag,
      senderSrLevel: viewerSrLevel ?? 1,
      body: trimmed,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setUi((prev) => ({ ...prev, body: "", sending: true, error: "" }));
    try {
      const response = await fetch(`/api/dm/${targetUserId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Message failed.");
      }
      const payload = (await response.json().catch(() => null)) as
        | ChatMessage
        | null;
      if (payload?.id) {
        const resolvedMessage: ChatMessage = {
          id: payload.id,
          conversationId: payload.conversationId ?? conversationId,
          senderUserId: payload.senderUserId,
          senderGamertag: payload.senderGamertag,
          senderNametagColor: payload.senderNametagColor ?? null,
          senderSrLevel: payload.senderSrLevel ?? 1,
          body: payload.body,
          createdAt: payload.createdAt,
          status: "sent",
        };
        setMessages((prev) =>
          prev.map((item) => (item.id === tempId ? resolvedMessage : item))
        );
      } else {
        await loadMessages();
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, status: "failed" } : item
        )
      );
      setUi((prev) => ({
        ...prev,
        sending: false,
        error: err instanceof Error ? err.message : "Message failed.",
      }));
      return;
    }
    setUi((prev) => ({ ...prev, sending: false }));
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUi((prev) => ({ ...prev, body: event.target.value }));
    if (!typingActive.current) {
      typingActive.current = true;
      void publishTyping("start", {
        userId: viewerId,
        gamertag: viewerGamertag,
      });
    }
    if (typingStopTimer.current) {
      clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = setTimeout(() => {
      typingActive.current = false;
      void publishTyping("stop", {
        userId: viewerId,
        gamertag: viewerGamertag,
      });
    }, 1200);
  };

  const retryMessage = async (message: ChatMessage) => {
    await handleSend(
      {
        preventDefault: () => {},
      } as React.FormEvent<HTMLFormElement>,
      message.body
    );
  };

  return (
    <section className="rounded-md border border-ink/10 bg-sand p-6">
      <h2 className="text-lg font-semibold text-ink">
        Direct messages ·{" "}
        <span className="inline-flex items-center gap-2">
          <SocialRankBadge rank={targetSrLevel} size={16} />
          <GamertagLink
            gamertag={targetGamertag}
            style={{ color: resolveNametagColor(targetNametagColor) }}
          />
          <span className="text-[10px] text-ink/60">
            {rankToLabel(targetSrLevel)}
          </span>
        </span>
      </h2>
      <div
        ref={listRef}
        className="scrollbar-dark mt-4 max-h-80 space-y-3 overflow-y-auto rounded-sm border border-ink/10 bg-mist p-3 text-sm"
      >
        {sortedMessages.length === 0 && (
          <p className="text-xs text-ink/60">No messages yet.</p>
        )}
        {sortedMessages.map((message) => {
          const time = hydrated
            ? new Date(message.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "";
          return (
            <div
              key={message.id}
              className={`rounded-sm border border-ink/10 px-3 py-2 ${
                message.senderUserId === viewerId ? "bg-sand" : "bg-mist"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-ink/60">
                <div className="flex items-center gap-2">
                  <SocialRankBadge rank={message.senderSrLevel} size={16} />
                  <GamertagLink
                    gamertag={message.senderGamertag}
                    className="font-semibold"
                    style={{
                      color: resolveNametagColor(message.senderNametagColor),
                    }}
                  />
                  <span className="text-[10px] text-ink/60">
                    {rankToLabel(message.senderSrLevel)}
                  </span>
                </div>
                <span suppressHydrationWarning>{time}</span>
              </div>
              <div className="mt-1 flex items-start justify-between gap-3 text-sm text-ink/80">
                <p className="break-words whitespace-pre-wrap">
                  {message.body}
                </p>
                {message.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => retryMessage(message)}
                    className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70 hover:border-ink/40"
                  >
                    Retry
                  </button>
                )}
                {message.status === "sending" && (
                  <span className="text-[10px] text-ink/60">Sending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(typingUsers).length > 0 && (
        <p className="mt-3 text-xs text-ink/60">
          {Object.values(typingUsers).join(", ")}{" "}
          {Object.keys(typingUsers).length > 1 ? "are" : "is"} typing...
        </p>
      )}
      {ui.error && <p className="mt-3 text-xs text-clay">{ui.error}</p>}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={ui.body}
          onChange={handleInputChange}
          placeholder="Send a direct message"
          className="flex-1 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={ui.sending}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {ui.sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
