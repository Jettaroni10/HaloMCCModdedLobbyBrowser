"use client";

import { useEffect, useMemo, useState } from "react";
import ReportForm from "./ReportForm";

type LobbySummary = {
  id: string;
  title: string;
  game: string;
  mode: string;
  map: string;
  region: string;
  platform: string;
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
  requesterPlatform: string;
  note: string | null;
  confirmedSubscribed: boolean;
  confirmedEacOff: boolean;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  lobby: {
    id: string;
    title: string;
    isModded: boolean;
  };
};

type InviteChecklist = {
  requester: {
    platform: string;
    handleText: string;
  };
  modded?: {
    workshopCollectionUrl: string | null;
    workshopItemUrls: string[];
    requiresEacOff: boolean;
    requesterConfirmedSubscribed: boolean;
    requesterConfirmedEacOff: boolean;
  };
  steps: { id: string; label: string; copyText?: string }[];
  copyStrings: Record<string, string>;
};

type HostDashboardProps = {
  lobbies: LobbySummary[];
  requests: JoinRequestSummary[];
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

export default function HostDashboard({ lobbies, requests }: HostDashboardProps) {
  const [activeLobbies, setActiveLobbies] = useState<LobbySummary[]>(lobbies);
  const [allRequests, setAllRequests] = useState<JoinRequestSummary[]>(requests);
  const [tab, setTab] = useState<JoinRequestSummary["status"]>("PENDING");
  const [checklist, setChecklist] = useState<InviteChecklist | null>(null);

  const filteredRequests = useMemo(
    () => allRequests.filter((request) => request.status === tab),
    [allRequests, tab]
  );

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

  useEffect(() => {
    const source = new EventSource("/api/host/events");

    source.addEventListener("request_created", (event) => {
      const payload = JSON.parse(
        (event as MessageEvent).data
      ) as JoinRequestSummary;
      setAllRequests((prev) => [payload, ...prev]);
    });

    source.addEventListener("lobby_expired", (event) => {
      const payload = JSON.parse((event as MessageEvent).data) as {
        id: string;
        expiresAt: string;
      };
      setActiveLobbies((prev) =>
        prev.map((item) =>
          item.id === payload.id
            ? { ...item, isActive: false, expiresAt: payload.expiresAt }
            : item
        )
      );
    });

    return () => {
      source.close();
    };
  }, []);

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
      <section className="rounded-3xl border border-ink/10 bg-sand p-6">
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
              className="rounded-2xl border border-ink/10 bg-mist p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{lobby.title}</p>
                  <p className="text-xs text-ink/60">
                    {lobby.game} · {lobby.mode} · {lobby.map}
                  </p>
                  <p className="text-xs text-ink/50">
                    {formatCountdown(lobby.expiresAt)} ·{" "}
                    {formatUpdated(lobby.lastHeartbeatAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => sendHeartbeat(lobby.id)}
                    className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
                  >
                    Heartbeat
                  </button>
                  <a
                    href={`/host/lobbies/${lobby.id}/edit`}
                    className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
                  >
                    Edit
                  </a>
                  <button
                    type="button"
                    onClick={() => closeLobby(lobby.id)}
                    className="rounded-full border border-clay/40 px-3 py-1 text-xs font-semibold text-clay hover:border-clay/60"
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

      <section className="rounded-3xl border border-ink/10 bg-sand p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Join Requests</h2>
        </div>
        <div className="mt-3 flex gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
          {(["PENDING", "ACCEPTED", "DECLINED"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-full px-3 py-1 ${
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
              className="rounded-2xl border border-ink/10 bg-mist p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    {request.requesterHandleText} ·{" "}
                    {request.requesterPlatform}
                  </p>
                  <p className="text-xs text-ink/60">
                    Lobby: {request.lobby.title}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "accept")}
                      className="rounded-full bg-ink px-3 py-1 text-xs font-semibold text-sand"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "decline")}
                      className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => actOnRequest(request.id, "block")}
                      className="rounded-full border border-clay/40 px-3 py-1 text-xs font-semibold text-clay"
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
                  Mods: subscribed{" "}
                  {request.confirmedSubscribed ? "yes" : "no"} · EAC off noted{" "}
                  {request.confirmedEacOff ? "yes" : "no"}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {checklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-sand p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-ink">
                  Invite checklist
                </h3>
                <p className="text-sm text-ink/70">
                  {checklist.requester.handleText} ·{" "}
                  {checklist.requester.platform}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChecklist(null)}
                className="text-sm text-ink/60"
              >
                Close
              </button>
            </div>

            <ol className="mt-4 space-y-3 text-sm text-ink/70">
              {checklist.steps.map((step) => (
                <li key={step.id} className="rounded-2xl border border-ink/10 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{step.label}</span>
                    {step.copyText && (
                      <button
                        type="button"
                        onClick={() =>
                          navigator.clipboard.writeText(step.copyText ?? "")
                        }
                        className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink"
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>

            {checklist.modded && (
              <div className="mt-4 rounded-2xl border border-ink/10 bg-mist p-3 text-xs text-ink/70">
                <p className="font-semibold text-ink">Modded lobby</p>
                {checklist.modded.workshopCollectionUrl && (
                  <p className="mt-1">
                    Collection: {checklist.modded.workshopCollectionUrl}
                  </p>
                )}
                {checklist.modded.workshopItemUrls.length > 0 && (
                  <p className="mt-1">
                    Items: {checklist.modded.workshopItemUrls.length}
                  </p>
                )}
                <p className="mt-1">
                  EAC off may be required:{" "}
                  {checklist.modded.requiresEacOff ? "yes" : "no"}
                </p>
              </div>
            )}

            <div className="mt-4 space-y-2 text-xs text-ink/60">
              <p>{checklist.copyStrings.steamInstructions}</p>
              <p>{checklist.copyStrings.xboxInstructions}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
