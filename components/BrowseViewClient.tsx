"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEnum } from "@/lib/format";
import { formatMinutesAgo } from "@/lib/time";
import { Games, Regions, Vibes, Voices } from "@/lib/types";
import LobbyCardBackground from "@/components/LobbyCardBackground";
import GamertagLink from "@/components/GamertagLink";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import BrowseAnalyticsTracker from "@/components/analytics/BrowseAnalyticsTracker";
import TrackedLobbyLink from "@/components/analytics/TrackedLobbyLink";
import OverlayLobbyTelemetryLine from "@/components/OverlayLobbyTelemetryLine";
import OverlayLobbyTelemetrySlots from "@/components/OverlayLobbyTelemetrySlots";
import { createBrowseRealtimeClient } from "@/lib/realtime/ablyClient";

type BrowseLobby = {
  id: string;
  title: string;
  game: string;
  region: string;
  voice: string;
  vibe: string;
  isModded: boolean;
  modCount: number;
  map: string;
  mode: string;
  slotsTotal: number | null;
  memberCount: number;
  lastHeartbeatAt: string;
  mapImageUrl: string | null;
  isHosting: boolean;
  isMember: boolean;
  telemetryMapName: string | null;
  telemetryModeName: string | null;
  telemetryPlayerCount: number | null;
  telemetryStatus: string | null;
  telemetrySeq: number | null;
  telemetryEmittedAt: string | null;
  telemetryUpdatedAt: string | null;
  host: {
    gamertag: string;
    srLevel: number | null;
  };
};

type BrowseFilters = {
  game: string;
  region: string;
  voice: string;
  vibe: string;
  tags: string;
};

type BrowseViewClientProps = {
  initialLobbies: BrowseLobby[];
  filters: BrowseFilters;
  dbReady: boolean;
  initialNow: string;
};

type TelemetryUpdate = {
  lobbyId: string;
  telemetryMapName?: string | null;
  telemetryModeName?: string | null;
  telemetryPlayerCount?: number | null;
  telemetryStatus?: string | null;
  telemetrySeq?: number | null;
  telemetryEmittedAt?: string | null;
  telemetryUpdatedAt?: string | null;
};

function normalizeTelemetryUpdate(payload: unknown): TelemetryUpdate | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const lobbyId = typeof data.lobbyId === "string" ? data.lobbyId : "";
  if (!lobbyId) return null;
  const mapName = typeof data.mapName === "string" ? data.mapName : null;
  const modeName = typeof data.modeName === "string" ? data.modeName : null;
  const playerCount =
    typeof data.playerCount === "number" ? data.playerCount : null;
  const status = typeof data.status === "string" ? data.status : null;
  const seq = typeof data.seq === "number" ? data.seq : null;
  const emittedAt =
    typeof data.emittedAt === "string" ? data.emittedAt : null;
  const updatedAt =
    typeof data.updatedAt === "string" ? data.updatedAt : null;

  return {
    lobbyId,
    telemetryMapName: mapName,
    telemetryModeName: modeName,
    telemetryPlayerCount: playerCount,
    telemetryStatus: status,
    telemetrySeq: seq,
    telemetryEmittedAt: emittedAt,
    telemetryUpdatedAt: updatedAt,
  };
}

function applyTelemetryUpdates(
  prev: BrowseLobby[],
  updates: Map<string, TelemetryUpdate>
) {
  if (updates.size === 0) return prev;
  return prev.map((lobby) => {
    const update = updates.get(lobby.id);
    if (!update) return lobby;
    let changed = false;
    const next = { ...lobby };
    ([
      "telemetryMapName",
      "telemetryModeName",
      "telemetryPlayerCount",
      "telemetryStatus",
      "telemetrySeq",
      "telemetryEmittedAt",
      "telemetryUpdatedAt",
    ] as const).forEach((key) => {
      if (update[key] === undefined) return;
      if (next[key] !== update[key]) {
        changed = true;
        (next as Record<string, unknown>)[key] = update[key];
      }
    });
    return changed ? next : lobby;
  });
}

const LobbyCard = memo(function LobbyCard({
  lobby,
  position,
  now,
}: {
  lobby: BrowseLobby;
  position: number;
  now: Date;
}) {
  return (
    <TrackedLobbyLink
      href={`/lobbies/${lobby.id}`}
      lobbyId={lobby.id}
      game={lobby.game}
      isModded={lobby.isModded}
      modCount={lobby.modCount}
      position={position}
      className={`relative min-h-[140px] overflow-hidden rounded-xl border border-ink/10 bg-transparent p-5 transition-transform duration-150 ease-out hover:scale-[1.01] hover:shadow-xl ${
        lobby.isHosting
          ? "ring-2 ring-clay/80 shadow-[0_0_22px_rgba(74,163,255,0.35)]"
          : lobby.isMember
            ? "ring-2 ring-[rgba(181,155,58,0.85)] shadow-[0_0_22px_rgba(181,155,58,0.35)]"
            : ""
      }`}
    >
      <LobbyCardBackground
        imageUrl={lobby.mapImageUrl}
        fallbackMapName={lobby.telemetryMapName ?? lobby.map}
      />
      <div
        className="relative z-20"
        style={{ textShadow: "0 4px 16px rgba(0,0,0,0.95)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white">{lobby.title}</h2>
            <OverlayLobbyTelemetryLine
              fallbackMode={lobby.telemetryModeName ?? lobby.mode}
              fallbackMap={lobby.telemetryMapName ?? lobby.map}
              lobbyId={lobby.id}
              className="text-sm text-white/70"
              as="p"
              prefix={formatEnum(lobby.game)}
            />
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">
              {formatEnum(lobby.region)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 text-xs">
            {lobby.isHosting && (
              <span className="rounded-sm border border-clay/60 bg-clay/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_0_14px_rgba(74,163,255,0.5)]">
                Hosting
              </span>
            )}
            {!lobby.isHosting && lobby.isMember && (
              <span className="rounded-sm border border-[rgba(181,155,58,0.9)] bg-[rgba(181,155,58,0.35)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-[0_0_14px_rgba(181,155,58,0.55)]">
                In lobby
              </span>
            )}
            {lobby.isModded && (
              <span className="rounded-sm bg-white/10 px-3 py-1 font-semibold text-white">
                Modded
              </span>
            )}
            {lobby.isModded && lobby.modCount > 0 && (
              <span className="rounded-sm border border-white/30 bg-white/10 px-3 py-1 font-semibold text-white">
                Get Ready ({lobby.modCount} mods)
              </span>
            )}
            {lobby.voice === "MIC_REQUIRED" && (
              <span className="rounded-sm bg-white/10 px-3 py-1 font-semibold text-white">
                Mic required
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
          <span>{formatEnum(lobby.vibe)}</span>
          {lobby.slotsTotal !== null && (
            <>
              <span>•</span>
              <OverlayLobbyTelemetrySlots
                fallbackCurrentPlayers={
                  lobby.telemetryPlayerCount ?? lobby.memberCount
                }
                fallbackMaxPlayers={lobby.slotsTotal ?? 16}
                lobbyId={lobby.id}
              />
            </>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
          <span className="uppercase tracking-[0.2em] text-white/50">Host</span>
          <SocialRankBadge rank={lobby.host.srLevel ?? 1} size={16} />
          <GamertagLink
            gamertag={lobby.host.gamertag}
            className="font-semibold"
            asSpan
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-white/70">
          <span>
            {formatMinutesAgo(new Date(lobby.lastHeartbeatAt), now)}
          </span>
          <span className="rounded-sm border border-white/30 px-4 py-1.5 text-xs font-semibold text-white hover:border-white/60">
            View lobby
          </span>
        </div>
      </div>
    </TrackedLobbyLink>
  );
});

export default function BrowseViewClient({
  initialLobbies,
  filters,
  dbReady,
  initialNow,
}: BrowseViewClientProps) {
  const [lobbies, setLobbies] = useState<BrowseLobby[]>(initialLobbies);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState<Date>(() => new Date(initialNow));
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const pendingUpdatesRef = useRef<Map<string, TelemetryUpdate>>(new Map());
  const flushTimerRef = useRef<number | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.game) params.set("game", filters.game);
    if (filters.region) params.set("region", filters.region);
    if (filters.voice) params.set("voice", filters.voice);
    if (filters.vibe) params.set("vibe", filters.vibe);
    if (filters.tags) params.set("tags", filters.tags);
    return params.toString();
  }, [filters]);

  const flushTelemetryUpdates = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null;
      const updates = new Map(pendingUpdatesRef.current);
      pendingUpdatesRef.current.clear();
      if (updates.size === 0) return;
      setLobbies((prev) => applyTelemetryUpdates(prev, updates));
    }, 250);
  }, []);

  const enqueueTelemetryUpdate = useCallback(
    (update: TelemetryUpdate) => {
      if (!update.lobbyId) return;
      const existing = pendingUpdatesRef.current.get(update.lobbyId);
      if (existing) {
        pendingUpdatesRef.current.set(update.lobbyId, {
          ...existing,
          ...update,
        });
      } else {
        pendingUpdatesRef.current.set(update.lobbyId, update);
      }
      flushTelemetryUpdates();
    },
    [flushTelemetryUpdates]
  );

  const refreshList = useCallback(
    async (reason: "manual" | "poll" | "visibility") => {
      if (!dbReady || isRefreshing) return;
      setIsRefreshing(true);
      refreshAbortRef.current?.abort();
      const controller = new AbortController();
      refreshAbortRef.current = controller;
      try {
        const res = await fetch(
          `/api/browse${queryString ? `?${queryString}` : ""}`,
          { cache: "no-store", signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as BrowseLobby[];
        setLobbies(data);
        if (reason !== "poll") {
          setNow(new Date());
        }
      } catch {
        // ignore
      } finally {
        setIsRefreshing(false);
      }
    },
    [dbReady, isRefreshing, queryString]
  );

  useEffect(() => {
    setLobbies(initialLobbies);
  }, [initialLobbies]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current !== null) {
        window.clearTimeout(flushTimerRef.current);
      }
      refreshAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const client = createBrowseRealtimeClient();
    const channel = client.channels.get("lobbies:telemetry");

    const handleMessage = (message: { name?: string; data?: unknown }) => {
      if (message.name && message.name !== "lobby:telemetry") return;
      const update = normalizeTelemetryUpdate(message.data);
      if (!update) return;
      enqueueTelemetryUpdate(update);
    };

    const onConnected = () => setRealtimeConnected(true);
    const onDisconnected = () => setRealtimeConnected(false);
    const onFailed = () => setRealtimeConnected(false);

    client.connection.on("connected", onConnected);
    client.connection.on("disconnected", onDisconnected);
    client.connection.on("failed", onFailed);

    channel.subscribe("lobby:telemetry", handleMessage);

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        // ignore
      }
      client.connection.off("connected", onConnected);
      client.connection.off("disconnected", onDisconnected);
      client.connection.off("failed", onFailed);
      Promise.resolve()
        .then(() => client.close())
        .catch(() => {});
    };
  }, [dbReady, enqueueTelemetryUpdate]);

  useEffect(() => {
    if (!dbReady) return;
    if (realtimeConnected) return;

    let active = true;
    const poll = () => {
      if (!active || document.hidden) return;
      refreshList("poll");
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshList("visibility");
      }
    };

    const timer = window.setInterval(poll, 12000);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [dbReady, realtimeConnected, refreshList]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
      <BrowseAnalyticsTracker />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink">Browse lobbies</h1>
          <p className="mt-2 text-sm text-ink/70">
            Filters are opt-in. Only host-published lobbies appear here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refreshList("manual")}
            disabled={!dbReady || isRefreshing}
            className="inline-flex items-center gap-2 rounded-sm border border-ink/20 bg-sand px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-ink/70 transition hover:border-ink/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRefreshing && (
              <span className="h-3 w-3 animate-spin rounded-full border border-ink/40 border-t-transparent" />
            )}
            Refresh
          </button>
        </div>
      </div>

      <form className="grid gap-4 rounded-md border border-ink/10 bg-sand p-5 md:grid-cols-5">
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Game
          <select
            name="game"
            defaultValue={filters.game}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Games.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Region
          <select
            name="region"
            defaultValue={filters.region}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Regions.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Mic
          <select
            name="voice"
            defaultValue={filters.voice}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Voices.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Vibe
          <select
            name="vibe"
            defaultValue={filters.vibe}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          >
            <option value="">All</option>
            {Vibes.map((value) => (
              <option key={value} value={value}>
                {formatEnum(value)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
          Tags
          <input
            name="tags"
            defaultValue={filters.tags}
            placeholder="chill, co-op"
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm text-ink"
          />
        </label>
        <div className="md:col-span-5">
          <button
            type="submit"
            className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
          >
            Apply filters
          </button>
        </div>
      </form>

      {!dbReady && (
        <div className="rounded-sm border border-ink/10 bg-mist p-4 text-sm text-ink/70">
          Configure <code className="font-semibold">DATABASE_URL</code> to load
          live listings. Until then, the browse view stays empty.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {lobbies.map((lobby, index) => (
          <LobbyCard
            key={lobby.id}
            lobby={lobby}
            position={index + 1}
            now={now}
          />
        ))}
      </div>

      {lobbies.length === 0 && dbReady && (
        <div className="rounded-sm border border-ink/10 bg-mist p-6 text-sm text-ink/70">
          No lobbies match those filters. Try clearing filters or check back
          soon.
        </div>
      )}
    </div>
  );
}
