"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { resolveNametagColor } from "@/lib/reach-colors";
import { useLobbyChatRealtime } from "./useLobbyChatRealtime";

type ChatMessage = {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  senderNametagColor?: string | null;
  body: string;
  createdAt: string;
  status?: "sending" | "failed" | "sent";
};

type LobbyChatProps = {
  lobbyId: string;
  viewerId: string;
  viewerDisplayName: string;
  viewerNametagColor?: string | null;
  initialMessages: ChatMessage[];
  className?: string;
};

export default function LobbyChat({
  lobbyId,
  viewerId,
  viewerDisplayName,
  viewerNametagColor,
  initialMessages,
  className,
}: LobbyChatProps) {
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

  const { publishTyping } = useLobbyChatRealtime({
    lobbyId,
    onMessage: (message) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        return [...prev, message];
      });
    },
    onTypingStart: (payload) => {
      if (payload.userId === viewerId) return;
      setTypingUsers((prev) => ({
        ...prev,
        [payload.userId]: payload.displayName,
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
    const response = await fetch(`/api/lobbies/${lobbyId}/chat`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json().catch(() => null)) as
      | ChatMessage[]
      | null;
    if (!Array.isArray(data)) return;
    setMessages(data);
    requestAnimationFrame(scrollToBottom);
  }, [lobbyId]);

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
        displayName: viewerDisplayName,
      });
    }
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      senderUserId: viewerId,
      senderDisplayName: viewerDisplayName,
      senderNametagColor: viewerNametagColor,
      body: trimmed,
      createdAt: new Date().toISOString(),
      status: "sending",
    };
    setMessages((prev) => [...prev, optimisticMessage]);
    setUi((prev) => ({ ...prev, body: "", sending: true, error: "" }));
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/chat`, {
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
        | { message?: ChatMessage | null }
        | null;
      if (payload?.message) {
        const resolvedMessage: ChatMessage = {
          id: payload.message.id,
          senderUserId: payload.message.senderUserId,
          senderDisplayName: payload.message.senderDisplayName,
          senderNametagColor: payload.message.senderNametagColor ?? null,
          body: payload.message.body,
          createdAt: payload.message.createdAt,
          status: "sent",
        };
        setMessages((prev) =>
          prev.map((item) =>
            item.id === tempId ? resolvedMessage : item
          )
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
        displayName: viewerDisplayName,
      });
    }
    if (typingStopTimer.current) {
      clearTimeout(typingStopTimer.current);
    }
    typingStopTimer.current = setTimeout(() => {
      typingActive.current = false;
      void publishTyping("stop", {
        userId: viewerId,
        displayName: viewerDisplayName,
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

  const baseClass =
    "rounded-md border border-white/10 bg-black/40 p-6 backdrop-blur-sm";

  return (
    <section className={`${baseClass} ${className ?? ""}`}>
      <h2 className="text-lg font-semibold text-white">Lobby chat</h2>
      <div
        ref={listRef}
        className="scrollbar-dark mt-4 max-h-80 space-y-3 overflow-y-auto rounded-sm border border-white/10 bg-black/30 p-3 text-sm text-white/80"
      >
        {sortedMessages.length === 0 && (
          <p className="text-xs text-white/60">No messages yet.</p>
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
              className={`overflow-hidden rounded-sm border border-white/10 px-3 py-2 ${
                message.senderUserId === viewerId ? "bg-black/30" : "bg-black/20"
              }`}
            >
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-white/60">
                <span
                  className="max-w-[70%] truncate font-semibold"
                  style={{
                    color: resolveNametagColor(message.senderNametagColor),
                  }}
                >
                  {message.senderDisplayName}
                </span>
                <span suppressHydrationWarning>{time}</span>
              </div>
              <div className="mt-1 flex items-start justify-between gap-3 text-sm text-white/80">
                <p className="break-words whitespace-pre-wrap">
                  {message.body}
                </p>
                {message.status === "failed" && (
                  <button
                    type="button"
                    onClick={() => retryMessage(message)}
                    className="rounded-sm border border-white/30 px-2 py-1 text-[10px] font-semibold text-white/80 hover:border-white/60"
                  >
                    Retry
                  </button>
                )}
                {message.status === "sending" && (
                  <span className="text-[10px] text-white/50">Sending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {Object.keys(typingUsers).length > 0 && (
        <p className="mt-3 text-xs text-white/60">
          {Object.values(typingUsers).join(", ")}{" "}
          {Object.keys(typingUsers).length > 1 ? "are" : "is"} typing...
        </p>
      )}
      {ui.error && <p className="mt-3 text-xs text-clay">{ui.error}</p>}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={ui.body}
          onChange={handleInputChange}
          placeholder="Send a message"
          className="flex-1 rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={ui.sending}
          className="rounded-sm bg-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {ui.sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
