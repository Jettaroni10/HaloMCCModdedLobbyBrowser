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

  async function handleClick() {
    if (state !== "available") return;
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

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={state !== "available"}
        className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === "friends"
          ? "Friends"
          : state === "pending"
          ? "Pending"
          : "Add Friend"}
      </button>
      {error && <span className="text-[10px] text-clay">{error}</span>}
    </div>
  );
}
