"use client";

import { useState } from "react";
import { resolveNametagColor } from "@/lib/reach-colors";
import GamertagLink from "@/components/GamertagLink";

type FriendUser = {
  id: string;
  gamertag: string;
  nametagColor?: string | null;
};

type IncomingRequest = {
  id: string;
  createdAt: string;
  fromUser: FriendUser;
};

type OutgoingRequest = {
  id: string;
  createdAt: string;
  toUser: FriendUser;
};

type FriendsViewProps = {
  currentUserId: string;
  initialFriends: FriendUser[];
  initialIncoming: IncomingRequest[];
  initialOutgoing: OutgoingRequest[];
};

export default function FriendsView({
  currentUserId,
  initialFriends,
  initialIncoming,
  initialOutgoing,
}: FriendsViewProps) {
  const [friends, setFriends] = useState<FriendUser[]>(initialFriends);
  const [incoming, setIncoming] = useState<IncomingRequest[]>(initialIncoming);
  const [outgoing, setOutgoing] = useState<OutgoingRequest[]>(initialOutgoing);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/friends");
    if (!response.ok) return;
    const data = (await response.json()) as {
      friends: FriendUser[];
      incomingRequests: IncomingRequest[];
      outgoingRequests: OutgoingRequest[];
    };
    setFriends(data.friends);
    setIncoming(data.incomingRequests);
    setOutgoing(data.outgoingRequests);
  }

  async function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/users/search?query=${encodeURIComponent(query.trim())}`
      );
      if (!response.ok) {
        throw new Error("Search failed.");
      }
      const data = (await response.json()) as FriendUser[];
      setResults(data.filter((user) => user.id !== currentUserId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function sendRequest(userId: string) {
    setError("");
    const response = await fetch("/api/friends/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toUserId: userId }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Unable to send request.");
      return;
    }
    await refresh();
  }

  async function acceptRequest(requestId: string) {
    setError("");
    const response = await fetch("/api/friends/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Unable to accept request.");
      return;
    }
    await refresh();
  }

  async function declineRequest(requestId: string) {
    setError("");
    const response = await fetch("/api/friends/decline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Unable to decline request.");
      return;
    }
    await refresh();
  }

  async function removeFriend(userId: string) {
    setError("");
    const response = await fetch("/api/friends/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Unable to remove friend.");
      return;
    }
    await refresh();
  }

  const outgoingIds = new Set(outgoing.map((req) => req.toUser.id));
  const friendIds = new Set(friends.map((friend) => friend.id));

  return (
    <div className="space-y-8">
      <section className="rounded-sm border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Find players</h2>
        <p className="mt-2 text-sm text-ink/70">
          Search by gamertag to send friend requests.
        </p>
        <form onSubmit={handleSearch} className="mt-4 flex flex-wrap gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search gamertags"
            className="flex-1 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand"
            disabled={loading}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>
        {error && <p className="mt-3 text-xs text-clay">{error}</p>}
        {results.length > 0 && (
          <div className="mt-4 space-y-2">
            {results.map((result) => (
              <div
                key={result.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
              >
                <div>
                  <GamertagLink
                    gamertag={result.gamertag}
                    className="font-semibold"
                    style={{
                      color: resolveNametagColor(result.nametagColor),
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => sendRequest(result.id)}
                  disabled={friendIds.has(result.id) || outgoingIds.has(result.id)}
                  className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {friendIds.has(result.id)
                    ? "Friends"
                    : outgoingIds.has(result.id)
                    ? "Pending"
                    : "Add Friend"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-sm border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Friend requests</h2>
        {incoming.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">No incoming requests.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {incoming.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
              >
                <div>
                  <GamertagLink
                    gamertag={request.fromUser.gamertag}
                    className="font-semibold"
                    style={{
                      color: resolveNametagColor(
                        request.fromUser.nametagColor
                      ),
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => acceptRequest(request.id)}
                    className="rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => declineRequest(request.id)}
                    className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {outgoing.length > 0 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
              Pending sent
            </p>
            <div className="mt-3 space-y-2">
              {outgoing.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
                >
                <div>
                  <GamertagLink
                    gamertag={request.toUser.gamertag}
                    className="font-semibold"
                    style={{
                      color: resolveNametagColor(request.toUser.nametagColor),
                    }}
                  />
                  </div>
                  <span className="text-xs text-ink/60">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-sm border border-ink/10 bg-sand p-6">
        <h2 className="text-lg font-semibold text-ink">Friends</h2>
        {friends.length === 0 ? (
          <p className="mt-3 text-sm text-ink/60">No friends yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
              >
                <div>
                  <GamertagLink
                    gamertag={friend.gamertag}
                    className="font-semibold"
                    style={{
                      color: resolveNametagColor(friend.nametagColor),
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/dm/${friend.id}`}
                    className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                  >
                    Message
                  </a>
                  <button
                    type="button"
                    onClick={() => removeFriend(friend.id)}
                    className="rounded-sm border border-clay/40 px-3 py-1 text-xs font-semibold text-clay"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
