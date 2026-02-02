"use client";

import { useEffect, useMemo, useState } from "react";
import ReportForm from "./ReportForm";
import {
  useHostEvents,
  type HostRequestCreatedEvent,
  type HostLobbyExpiredEvent,
} from "./useHostEvents";
import Nametag from "@/components/user/Nametag";

type LobbySummary = {
  id: string;
  title: string;
  game: string;
  mode: string;
  map: string;
  region: string;
  voice: string;
  vibe: string;
  isActive: boolean;
  isModded: boolean;
  lastHeartbeatAt: string;
  expiresAt: string;
  slotsOpen: number | null;
  slotsTotal: number | null;
};

type JoinRequestSummary = {
  id: string;
  requesterUserId: string;
  requesterHandleText: string;
  requesterNametagColor?: string | null;
  requesterSrLevel?: number | null;
  note: string | null;
  confirmedSubscribed: boolean;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  lobby: {
    id: string;
    title: string;
    isModded: boolean;
  };
};

type InviteChecklist = {
  requester: {
    gamertag: string;
    nametagColor?: string | null;
  };
  modded?: {
    workshopCollectionUrl: string | null;
    workshopItemUrls: string[];
    requesterConfirmedSubscribed: boolean;
  };
  steps: { id: string; label: string; copyText?: string }[];
  copyStrings: Record<string, string>;
};

type HostDashboardProps = {
  lobbies: LobbySummary[];
  requests: JoinRequestSummary[];
  hostUserId: string;
};

function formatCountdown(dateString: string) {
  const diffMs = new Date(dateString).getTime() - Date.now();
  const minutes = Math.ceil(diffMs / 60000);
  if (minutes <= 0) {
    return "Expired";
  }
  return `Expires in ${minutes} min`;
}

function formatUpdated(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  return minutes <= 0 ? "Updated just now" : `Updated ${minutes} min ago`;
}

export default function HostDashboard({
  lobbies,
  requests,
  hostUserId,
}: HostDashboardProps) {
  const [hydrated, setHydrated] = useState(false);
  const [activeLobbies, setActiveLobbies] = useState<LobbySummary[]>(lobbies);
  const [allRequests, setAllRequests] = useState<JoinRequestSummary[]>(requests);
  const [tab, setTab] = useState<JoinRequestSummary["status"]>("PENDING");
  const [checklist, setChecklist] = useState<InviteChecklist | null>(null);
  const {
    toasts,
    dismissToast,
    unreadCount,
    markViewed,
    muted,
    setMuted,
    soundBlocked,
    enableSound,
  } = useHostEvents({
    hostUserId,
    onRequestCreated: (payload: HostRequestCreatedEvent) => {
      setAllRequests((prev) => {
        if (prev.some((item) => item.id === payload.id)) {
          return prev;
        }
        const normalized: JoinRequestSummary = {
          id: payload.id,
          requesterUserId: payload.requesterUserId,
          requesterHandleText: payload.requesterHandleText,
          requesterNametagColor: payload.requesterNametagColor ?? null,
          requesterSrLevel: payload.requesterSrLevel ?? null,
          note: payload.note ?? null,
          confirmedSubscribed: payload.confirmedSubscribed ?? false,
          status: payload.status ?? "PENDING",
          lobby: payload.lobby,
        };
        return [normalized, ...prev];
      });
    },
    onRequestDecided: (payload) => {
      setAllRequests((prev) =>
        prev.map((item) =>
          item.id === payload.id ? { ...item, status: payload.status } : item
        )
      );
    },
    onLobbyExpired: (payload: HostLobbyExpiredEvent) => {
      setActiveLobbies((prev) =>
        prev.map((item) =>
          item.id === payload.id
            ? { ...item, isActive: false, expiresAt: payload.expiresAt }
            : item
        )
      );
    },
  });

  const filteredRequests = useMemo(
    () => allRequests.filter((request) => request.status === tab),
    [allRequests, tab]
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      activeLobbies.forEach((lobby) => {
        if (!lobby.isActive) return;
        fetch(`/api/lobbies/${lobby.id}/heartbeat`, { method: "POST" })
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (!data) return;
            setActiveLobbies((prev) =>
              prev.map((item) =>
                item.id === lobby.id
                  ? {
                      ...item,
                      lastHeartbeatAt: data.lastHeartbeatAt,
                      expiresAt: data.expiresAt,
                    }
                  : item
              )
            );
          })
          .catch(() => {});
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [activeLobbies]);

  function handleTabClick(value: JoinRequestSummary["status"]) {
    setTab(value);
    if (unreadCount > 0) {
      markViewed();
    }
  }

  async function sendHeartbeat(lobbyId: string) {
    const response = await fetch(`/api/lobbies/${lobbyId}/heartbeat`, {
      method: "POST",
    });
    if (!response.ok) return;
    const data = (await response.json()) as LobbySummary;
    setActiveLobbies((prev) =>
      prev.map((item) => (item.id === lobbyId ? { ...item, ...data } : item))
    );
  }

  async function closeLobby(lobbyId: string) {
    const response = await fetch(`/api/lobbies/${lobbyId}/close`, {
      method: "POST",
    });
    if (!response.ok) return;
    const data = (await response.json()) as LobbySummary;
    setActiveLobbies((prev) =>
      prev.map((item) => (item.id === lobbyId ? { ...item, ...data } : item))
    );
  }

  async function actOnRequest(
    requestId: string,
    action: "accept" | "decline" | "block"
  ) {
    const response = await fetch(`/api/requests/${requestId}/${action}`, {
      method: "POST",
    });
    if (!response.ok) return;

    if (action === "accept") {
      const payload = (await response.json()) as InviteChecklist;
      setChecklist(payload);
    }

    setAllRequests((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? { ...item, status: action === "accept" ? "ACCEPTED" : "DECLINED" }
          : item
      )
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      {toasts.length > 0 && (
        <div className="fixed right-6 top-6 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-sm border border-ink/20 bg-sand px-4 py-2 text-sm text-ink shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-xs font-semibold text-ink/60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <section className="rounded-md border border-ink/10 bg-sand p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">My Active Lobbies</h2>
        </div>
        <div className="mt-4 space-y-4">
          {activeLobbies.length === 0 && (
            <p className="text-sm text-ink/60">
              You have no active lobbies yet.
            </p>
          )}
          {activeLobbies.map((lobby) => (
            <div
              key={lobby.id}
              className="rounded-sm border border-ink/10 bg-mist p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{lobby.title}</p>
                  <p className="text-xs text-ink/60">
                    {lobby.game} · {lobby.mode} · {lobby.map}
                  </p>
                  <p
                    className="text-xs text-ink/50"
                    suppressHydrationWarning
                  >
                    {hydrated
                      ? `${formatCountdown(lobby.expiresAt)} · ${formatUpdated(
                          lobby.lastHeartbeatAt
                        )}`
                      : "Checking status…"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sendHeartbeat(lobby.id)}
                    className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
                  >
                    Heartbeat
                  </button>
                  <a
                    href={`/host/lobbies/${lobby.id}/edit`}
                    className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
                  >
                    Edit
                  </a>
                  <button
                    type="button"
                    onClick={() => closeLobby(lobby.id)}
                    className="rounded-sm border border-clay/40 px-3 py-1 text-xs font-semibold text-clay hover:border-clay/60"
                  >
                    Close
                  </button>
                </div>
              </div>
              {lobby.slotsTotal !== null && (
                <p className="mt-2 text-xs text-ink/60">
                  Slots {lobby.slotsOpen ?? "?"}/{lobby.slotsTotal}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-sand p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-ink">Join Requests</h2>
            {unreadCount > 0 && (
              <span className="rounded-sm bg-clay/20 px-2 py-0.5 text-xs font-semibold text-ink">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs font-semibold text-ink/60">
            {soundBlocked && !muted && (
              <button
                type="button"
                onClick={enableSound}
                className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70"
              >
                🔔 Enable sounds
              </button>
            )}
            <label className="flex items-center gap-2 text-xs font-semibold text-ink/60">
              <input
                type="checkbox"
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink/20"
              />
              Mute pings
            </label>
          </div>
        </div>
        <div className="mt-3 flex gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          {(["PENDING", "ACCEPTED", "DECLINED"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabClick(value)}
              className={`rounded-sm px-3 py-1 ${
                tab === value ? "bg-ink text-sand" : "bg-ink/10 text-ink"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {filteredRequests.length === 0 && (
            <p className="text-sm text-ink/60">No requests in this tab.</p>
          )}
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-sm border border-ink/10 bg-mist p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Nametag
                    gamertag={request.requesterHandleText}
                    rank={request.requesterSrLevel ?? 1}
                    nametagColor={request.requesterNametagColor}
                    className="bg-mist"
                  />
                  <p className="text-xs text-ink/60">
                    Lobby: {request.lobby.title}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "accept")}
                      className="rounded-sm bg-ink px-3 py-1 text-xs font-semibold text-sand"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "decline")}
                      className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "block")}
                      className="rounded-sm border border-clay/40 px-3 py-1 text-xs font-semibold text-clay"
                    >
                      Block
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-2">
                <ReportForm
                  targetType="USER"
                  targetId={request.requesterUserId}
                  label="Report user"
                  isSignedIn={true}
                />
              </div>
              {request.note && (
                <p className="mt-2 text-xs text-ink/70">{request.note}</p>
              )}
              {request.lobby.isModded && (
                <div className="mt-3 text-xs text-ink/60">
                  Mods: subscribed {request.confirmedSubscribed ? "yes" : "no"}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-lg rounded-md bg-sand p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Invite player
                </h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
                  Gamertag
                </p>
                <div
                  className="mt-1 rounded-sm border border-ink/10 bg-mist px-3 py-2 text-lg font-semibold text-ink"
                  style={{
                    color: resolveNametagColor(
                      checklist.requester.nametagColor
                    ),
                  }}
                >
                  {checklist.requester.gamertag}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    navigator.clipboard.writeText(checklist.requester.gamertag)
                  }
                  className="rounded-sm border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                >
                  Copy gamertag
                </button>
                <button
                  type="button"
                  onClick={() => setChecklist(null)}
                  className="text-xs font-semibold text-ink/60"
                >
                  Close
                </button>
              </div>
            </div>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-ink/70">
              <li>Open Halo MCC.</li>
              <li>
                Find {checklist.requester.gamertag} on your friends list or
                recent players.
              </li>
              <li>Send an invite.</li>
            </ul>

            <p className="mt-3 text-xs text-ink/60">
              You can invite via Steam overlay, Xbox app, or in-game roster.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

