"use client";

import { useState } from "react";

type RosterFriendButtonProps = {
  targetUserId: string;
  initialState: "available" | "pending" | "friends";
};

export default function RosterFriendButton({
  targetUserId,
  initialState,
}: RosterFriendButtonProps) {
  const [state, setState] = useState(initialState);
  const [error, setError] = useState("");

  const isAvailable = state === "available";
  const isPending = state === "pending";
  const isFriends = state === "friends";

  async function handleClick() {
    if (!isAvailable) return;
    setError("");
    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: targetUserId }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Request failed.");
      return;
    }
    setState("pending");
  }

  const label = isFriends ? "Friends" : isPending ? "Pending" : "Add friend";
  const icon = isFriends ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l4 4L19 6" />
    </svg>
  ) : isPending ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );

  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={!isAvailable}
        title={error ? `${label} • ${error}` : label}
        aria-label={label}
        className="flex h-10 w-10 items-center justify-center rounded-sm border border-white/20 bg-mist/60 text-white/80 transition hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {icon}
      </button>
      {error && (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-clay" />
      )}
    </div>
  );
}
