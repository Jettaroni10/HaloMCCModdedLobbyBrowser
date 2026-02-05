"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type UserProfileActionsProps = {
  targetGamertag: string;
  targetUserId: string;
  isFriend: boolean;
  isPending: boolean;
  isBlocked: boolean;
  blockedByTarget: boolean;
  canInvite: boolean;
  canMessage: boolean;
};

export default function UserProfileActions({
  targetGamertag,
  targetUserId,
  isFriend,
  isPending,
  isBlocked,
  blockedByTarget,
  canInvite,
  canMessage,
}: UserProfileActionsProps) {
  const [friendState, setFriendState] = useState(() =>
    isFriend ? "friends" : isPending ? "pending" : "none"
  );
  const [blocked, setBlocked] = useState(isBlocked);
  const [inviteStatus, setInviteStatus] = useState("");
  const [error, setError] = useState("");

  async function sendFriendRequest() {
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
      setError(payload?.error || "Unable to send request.");
      return;
    }
    setFriendState("pending");
  }

  async function toggleBlock() {
    setError("");
    const action = blocked ? "unblock" : "block";
    const response = await fetch(`/api/users/${encodeURIComponent(targetGamertag)}/${action}`, {
      method: "POST",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Unable to update block.");
      return;
    }
    setBlocked(!blocked);
  }

  async function sendInvite() {
    setError("");
    setInviteStatus("");
    const response = await fetch(
      `/api/users/${encodeURIComponent(targetGamertag)}/invite`,
      {
        method: "POST",
      }
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Invite failed.");
      return;
    }
    setInviteStatus("Invite sent.");
    trackEvent("lobby_invite_sent");
  }

  if (blockedByTarget) {
    return (
      <div className="rounded-sm border border-ink/15 bg-mist px-3 py-2 text-xs text-ink/60">
        You cannot interact with this player.
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
      <a
        href={`/dm/${targetUserId}`}
        className={`rounded-sm border px-3 py-1 ${
          canMessage && !blocked
            ? "border-ink/20 bg-mist text-ink hover:border-ink/40"
            : "border-ink/10 bg-mist/50 text-ink/40 pointer-events-none"
        }`}
      >
        Message
      </a>
      {friendState === "none" && (
        <button
          type="button"
          onClick={sendFriendRequest}
          className="rounded-sm border border-ink/20 bg-mist px-3 py-1 text-ink hover:border-ink/40"
        >
          Add friend
        </button>
      )}
      {friendState === "pending" && (
        <span className="rounded-sm border border-ink/15 bg-mist px-3 py-1 text-ink/60">
          Pending
        </span>
      )}
      {friendState === "friends" && (
        <span className="rounded-sm border border-ink/15 bg-mist px-3 py-1 text-ink/60">
          Friends
        </span>
      )}
      <button
        type="button"
        onClick={toggleBlock}
        className="rounded-sm border border-clay/40 bg-mist px-3 py-1 text-clay hover:border-clay/60"
      >
        {blocked ? "Unblock" : "Block"}
      </button>
      <button
        type="button"
        onClick={sendInvite}
        disabled={!canInvite || blocked}
        className={`rounded-sm border px-3 py-1 ${
          canInvite && !blocked
            ? "border-ink/20 bg-mist text-ink hover:border-ink/40"
            : "border-ink/10 bg-mist/50 text-ink/40"
        }`}
      >
        Invite
      </button>
      {inviteStatus && <span className="text-ink/60">{inviteStatus}</span>}
      {error && <span className="text-clay">{error}</span>}
    </div>
  );
}
