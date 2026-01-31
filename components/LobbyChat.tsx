"use client";

import { useMemo, useState } from "react";
import { useLobbyEvents } from "./useLobbyEvents";
import { resolveNametagColor } from "@/lib/reach-colors";

type ChatMessage = {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  senderNametagColor?: string | null;
  body: string;
  createdAt: string;
};

type LobbyChatProps = {
  lobbyId: string;
  viewerId: string;
  initialMessages: ChatMessage[];
  className?: string;
};

export default function LobbyChat({
  lobbyId,
  viewerId,
  initialMessages,
  className,
}: LobbyChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useLobbyEvents({
    lobbyId,
    onMessageCreated: (message) => {
      setMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) return prev;
        return [...prev, message];
      });
    },
  });

  const sortedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [messages]
  );

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
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
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed.");
    } finally {
      setSending(false);
    }
  }

  const baseClass =
    "rounded-md border border-white/10 bg-black/40 p-6 backdrop-blur-sm";

  return (
    <section className={`${baseClass} ${className ?? ""}`}>
      <h2 className="text-lg font-semibold text-white">Lobby chat</h2>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-sm border border-white/10 bg-black/30 p-3 text-sm text-white/80">
        {sortedMessages.length === 0 && (
          <p className="text-xs text-white/60">No messages yet.</p>
        )}
        {sortedMessages.map((message) => {
          const time = new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div
              key={message.id}
              className={`rounded-sm border border-white/10 px-3 py-2 ${
                message.senderUserId === viewerId ? "bg-black/30" : "bg-black/20"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-white/60">
                <span
                  className="font-semibold"
                  style={{
                    color: resolveNametagColor(message.senderNametagColor),
                  }}
                >
                  {message.senderDisplayName}
                </span>
                <span>{time}</span>
              </div>
              <p className="mt-1 text-sm text-white/80">{message.body}</p>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Send a message"
          className="flex-1 rounded-sm border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-sm bg-white/15 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
