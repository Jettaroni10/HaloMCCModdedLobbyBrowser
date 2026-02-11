"use client";

import { useEffect, useMemo, useState } from "react";
import ReportForm from "./ReportForm";
import HostLobbyForm from "./HostLobbyForm";
import type {
  HostRequestCreatedEvent,
  HostLobbyExpiredEvent,
  HostRequestDecidedEvent,
} from "./useHostEvents";
import { useHostNotifications } from "./HostNotificationsProvider";
import Nametag from "@/components/user/Nametag";
import { resolveNametagColor } from "@/lib/reach-colors";
import { hashId, trackEvent } from "@/lib/analytics";

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
  className?: string;
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
  className,
}: HostDashboardProps) {
  const panelBase =
    "rounded-none border border-[#1b2a3a] bg-[#07111c] ring-1 ring-white/5";
  const panelInner =
    "rounded-none border border-[#1b2a3a] bg-[#091827] ring-1 ring-white/5";
  const sectionTitle =
    "text-sm font-semibold tracking-wider uppercase text-slate-200";
  const [hydrated, setHydrated] = useState(false);
  const [isOverlayEnv, setIsOverlayEnv] = useState(false);
  const [activeLobbies, setActiveLobbies] = useState<LobbySummary[]>(lobbies);
  const [allRequests, setAllRequests] = useState<JoinRequestSummary[]>(requests);
  const [tab, setTab] = useState<JoinRequestSummary["status"]>("PENDING");
  const [checklist, setChecklist] = useState<InviteChecklist | null>(null);
  const { unreadCount, markViewed } = useHostNotifications();

  const filteredRequests = useMemo(
    () => allRequests.filter((request) => request.status === tab),
    [allRequests, tab]
  );
  const tabCountLabel = useMemo(() => {
    const label = tab.toLowerCase();
    return `${filteredRequests.length} ${label}`;
  }, [filteredRequests.length, tab]);

  useEffect(() => {
    setHydrated(true);
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

  useEffect(() => {
    if (!hostUserId) return;
    const handleRequestCreated = (event: Event) => {
      const payload = (event as CustomEvent).detail as
        | HostRequestCreatedEvent
        | undefined;
      if (!payload) return;
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
          confirmedSubscribed: payload.confirmedSubscribed ?? false,
          status: payload.status ?? "PENDING",
          lobby: payload.lobby,
        };
        return [normalized, ...prev];
      });
    };

    const handleRequestDecided = (event: Event) => {
      const payload = (event as CustomEvent).detail as
        | HostRequestDecidedEvent
        | undefined;
      if (!payload) return;
      setAllRequests((prev) =>
        prev.map((item) =>
          item.id === payload.id ? { ...item, status: payload.status } : item
        )
      );
    };

    const handleLobbyExpired = (event: Event) => {
      const payload = (event as CustomEvent).detail as
        | HostLobbyExpiredEvent
        | undefined;
      if (!payload) return;
      setActiveLobbies((prev) =>
        prev.map((item) =>
          item.id === payload.id
            ? { ...item, isActive: false, expiresAt: payload.expiresAt }
            : item
        )
      );
    };

    window.addEventListener("customs:hostRequestCreated", handleRequestCreated);
    window.addEventListener("customs:hostRequestDecided", handleRequestDecided);
    window.addEventListener("customs:hostLobbyExpired", handleLobbyExpired);

    return () => {
      window.removeEventListener(
        "customs:hostRequestCreated",
        handleRequestCreated
      );
      window.removeEventListener(
        "customs:hostRequestDecided",
        handleRequestDecided
      );
      window.removeEventListener(
        "customs:hostLobbyExpired",
        handleLobbyExpired
      );
    };
  }, [hostUserId]);

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
    const lobby = activeLobbies.find((item) => item.id === lobbyId);
    const data = (await response.json()) as LobbySummary;
    setActiveLobbies((prev) =>
      prev.map((item) => (item.id === lobbyId ? { ...item, ...data } : item))
    );
    trackEvent("lobby_deleted", {
      lobby_id: hashId(lobbyId),
      game: lobby?.game ?? undefined,
      is_modded: lobby?.isModded ?? undefined,
    });
  }

  async function actOnRequest(
    requestId: string,
    action: "accept" | "decline" | "block"
  ) {
    const request = allRequests.find((item) => item.id === requestId);
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

    const lobbyMeta = request
      ? activeLobbies.find((item) => item.id === request.lobby.id)
      : undefined;
    if (action === "accept") {
      trackEvent("lobby_join_approved", {
        lobby_id: request ? hashId(request.lobby.id) : undefined,
        game: lobbyMeta?.game ?? undefined,
        is_modded: request?.lobby.isModded ?? undefined,
      });
    }
    if (action === "decline" || action === "block") {
      trackEvent("lobby_join_denied", {
        lobby_id: request ? hashId(request.lobby.id) : undefined,
        game: lobbyMeta?.game ?? undefined,
        is_modded: request?.lobby.isModded ?? undefined,
      });
    }
  }

  return (
    <div className={className ?? "grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]"}>
      <section
        className={
          isOverlayEnv
            ? "space-y-4"
            : `${panelBase} p-4`
        }
      >
        {isOverlayEnv ? (
          <HostLobbyForm
            submitLabel="Go Live"
            enableMapImage={false}
            enableTelemetryBinding={false}
            sessionMode={true}
          />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-100">
                My Active Lobbies
              </h2>
            </div>
            <div className="mt-4 space-y-4">
              {activeLobbies.length === 0 && (
                <p className="text-sm text-slate-400">
                  You have no active lobbies yet.
                </p>
              )}
              {activeLobbies.map((lobby) => (
                <div
                  key={lobby.id}
                  className={`${panelInner} p-4`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {lobby.title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {lobby.game} · {lobby.mode} · {lobby.map}
                      </p>
                      <p
                        className="text-xs text-slate-500"
                        suppressHydrationWarning
                      >
                        {hydrated
                          ? `${formatCountdown(
                              lobby.expiresAt
                            )} · ${formatUpdated(lobby.lastHeartbeatAt)}`
                          : "Checking status…"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => sendHeartbeat(lobby.id)}
                        className="border border-[#1b2a3a] bg-[#0b1a2a] px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-[#0f2236]"
                      >
                        Heartbeat
                      </button>
                      <a
                        href={`/host/lobbies/${lobby.id}/edit`}
                        className="border border-[#1b2a3a] bg-transparent px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-[#0b1a2a]"
                      >
                        Edit
                      </a>
                      <button
                        type="button"
                        onClick={() => closeLobby(lobby.id)}
                        className="border border-[#5a2328] bg-transparent px-3 py-1 text-xs font-semibold text-[#ff9aa2] hover:bg-[#2a0f13]"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  {lobby.slotsTotal !== null && (
                    <p className="mt-2 text-xs text-slate-400">
                      Slots {lobby.slotsOpen ?? "?"}/{lobby.slotsTotal}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className={`flex flex-col ${panelBase} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className={sectionTitle}>Join Requests</h2>
            <span className="border border-[#1b2a3a] bg-[#0b1a2a] px-2 py-0.5 text-xs font-semibold text-slate-200">
              {tabCountLabel}
            </span>
          </div>
        </div>
        <div className="mt-3 inline-flex border border-[#1b2a3a] bg-[#07111c]">
          {(["PENDING", "ACCEPTED", "DECLINED"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => handleTabClick(value)}
              className={`px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors ${
                tab === value
                  ? "bg-[#0b1a2a] text-slate-100"
                  : "text-slate-400 hover:bg-[#091827] hover:text-slate-200"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-4 max-h-[540px] space-y-3 overflow-auto pr-1">
          {filteredRequests.length === 0 && (
            <p className="text-sm text-slate-400">No requests in this tab.</p>
          )}
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="border border-[#1b2a3a] bg-[#07111c] p-3 text-sm transition-colors hover:bg-[#091827]"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="max-w-full">
                    <Nametag
                      gamertag={request.requesterHandleText}
                      rank={request.requesterSrLevel ?? 1}
                      nametagColor={request.requesterNametagColor}
                      className="rounded-none border-[#1b2a3a] bg-[#091827] px-3 py-2"
                    />
                  </div>
                  <p className="mt-2 truncate text-xs text-slate-400">
                    Lobby: {request.lobby.title}
                  </p>
                </div>
              </div>
              {request.status === "PENDING" && (
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => actOnRequest(request.id, "accept")}
                    className="border border-[#1b2a3a] bg-[#0b1a2a] px-3 py-2 text-xs font-semibold text-slate-100 hover:bg-[#0f2236]"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => actOnRequest(request.id, "decline")}
                    className="border border-[#1b2a3a] bg-transparent px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-[#0b1a2a]"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => actOnRequest(request.id, "block")}
                    className="border border-[#5a2328] bg-transparent px-3 py-2 text-xs font-semibold text-[#ff9aa2] hover:bg-[#2a0f13]"
                  >
                    Block
                  </button>
                </div>
              )}
              <div className="mt-2 flex justify-end text-right [&_button]:text-slate-400 [&_button]:underline [&_button]:decoration-white/20 [&_button]:hover:text-slate-200 [&_select]:border-[#1b2a3a] [&_select]:bg-[#0b1a2a] [&_select]:text-slate-100 [&_select]:placeholder:text-slate-500 [&_textarea]:border-[#1b2a3a] [&_textarea]:bg-[#0b1a2a] [&_textarea]:text-slate-100 [&_textarea]:placeholder:text-slate-500 [&_input]:border-[#1b2a3a] [&_input]:bg-[#0b1a2a] [&_input]:text-slate-100 [&_input]:placeholder:text-slate-500">
                <ReportForm
                  targetType="USER"
                  targetId={request.requesterUserId}
                  label="Report user"
                  isSignedIn={true}
                />
              </div>
              {request.lobby.isModded && (
                <div className="mt-2 text-xs text-slate-400">
                  Mods: subscribed {request.confirmedSubscribed ? "yes" : "no"}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className={`w-full max-w-lg p-6 ${panelBase}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Invite player
                </h3>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                  Gamertag
                </p>
                <div
                  className={`mt-1 px-3 py-2 text-lg font-semibold ${panelInner}`}
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
                  className="border border-[#1b2a3a] bg-[#0b1a2a] px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-[#0f2236]"
                >
                  Copy gamertag
                </button>
                <button
                  type="button"
                  onClick={() => setChecklist(null)}
                  className="text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>
            </div>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
              <li>Open Halo MCC.</li>
              <li>
                Find {checklist.requester.gamertag} on your friends list or
                recent players.
              </li>
              <li>Send an invite.</li>
            </ul>

            <p className="mt-3 text-xs text-slate-400">
              You can invite via Steam overlay or in-game roster.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

