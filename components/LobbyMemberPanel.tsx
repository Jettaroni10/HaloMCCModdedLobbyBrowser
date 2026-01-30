"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LobbyMemberPanelProps = {
  lobbyId: string;
};

export default function LobbyMemberPanel({ lobbyId }: LobbyMemberPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLeave() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/leave`, {
        method: "POST",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error || "Unable to leave lobby.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to leave lobby.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-sm border border-ink/10 bg-sand p-6">
      <h2 className="text-lg font-semibold text-ink">You&apos;re in roster</h2>
      <p className="mt-2 text-sm text-ink/70">
        The host has accepted your request. You&apos;re listed in the lobby
        roster.
      </p>
      {error && <p className="mt-3 text-xs text-clay">{error}</p>}
      <button
        type="button"
        onClick={handleLeave}
        disabled={loading}
        className="mt-4 rounded-sm border border-clay/40 px-4 py-2 text-xs font-semibold text-clay hover:border-clay/60 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Leaving..." : "Leave lobby"}
      </button>
    </div>
  );
}
