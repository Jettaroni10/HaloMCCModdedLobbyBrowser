"use client";

import { useState } from "react";
import { resolveNametagColor } from "@/lib/reach-colors";

type ChatMessage = {
  id: string;
  senderUserId: string;
  senderDisplayName: string;
  senderNametagColor?: string | null;
  body: string;
  createdAt: string;
};

type DmChatProps = {
  targetUserId: string;
  viewerId: string;
  initialMessages: ChatMessage[];
  targetDisplayName: string;
  targetNametagColor?: string | null;
};

export default function DmChat({
  targetUserId,
  viewerId,
  initialMessages,
  targetDisplayName,
  targetNametagColor,
}: DmChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError("");
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
      const created = (await response.json()) as ChatMessage;
      setMessages((prev) => [...prev, created]);
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-md border border-ink/10 bg-sand p-6">
      <h2 className="text-lg font-semibold text-ink">
        Direct messages ·{" "}
        <span style={{ color: resolveNametagColor(targetNametagColor) }}>
          {targetDisplayName}
        </span>
      </h2>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-sm border border-ink/10 bg-mist p-3 text-sm">
        {messages.length === 0 && (
          <p className="text-xs text-ink/60">No messages yet.</p>
        )}
        {messages.map((message) => {
          const time = new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });
          return (
            <div
              key={message.id}
              className={`rounded-sm border border-ink/10 px-3 py-2 ${
                message.senderUserId === viewerId ? "bg-sand" : "bg-mist"
              }`}
            >
              <div className="flex items-center justify-between text-xs text-ink/60">
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
              <p className="mt-1 text-sm text-ink/80">{message.body}</p>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
      <form onSubmit={handleSend} className="mt-4 flex gap-2">
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Send a direct message"
          className="flex-1 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={sending}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}
