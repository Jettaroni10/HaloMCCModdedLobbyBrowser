"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createLobbyRealtimeClient } from "@/lib/realtime/ablyClient";

export type ServerTelemetryState = {
  map?: string;
  mode?: string;
  currentPlayers?: number;
  status?: string;
  seq?: number;
  emittedAt?: string;
  updatedAt?: string;
};

function normalizeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return String(error);
}

function normalizeServerTelemetry(payload: unknown): ServerTelemetryState | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  const map =
    typeof data.telemetryMapName === "string"
      ? data.telemetryMapName
      : typeof data.mapName === "string"
        ? data.mapName
        : typeof data.map === "string"
          ? data.map
          : undefined;
  const mode =
    typeof data.telemetryModeName === "string"
      ? data.telemetryModeName
      : typeof data.modeName === "string"
        ? data.modeName
        : typeof data.mode === "string"
          ? data.mode
          : undefined;
  const currentPlayersRaw =
    data.telemetryPlayerCount ?? data.playerCount ?? data.currentPlayers;
  const currentPlayers = normalizeNumber(currentPlayersRaw);
  const status =
    typeof data.telemetryStatus === "string"
      ? data.telemetryStatus
      : typeof data.status === "string"
        ? data.status
        : undefined;
  const seq = normalizeNumber(data.telemetrySeq ?? data.seq);
  const emittedAt =
    typeof data.telemetryEmittedAt === "string"
      ? data.telemetryEmittedAt
      : typeof data.emittedAt === "string"
        ? data.emittedAt
        : undefined;
  const updatedAt =
    typeof data.telemetryUpdatedAt === "string"
      ? data.telemetryUpdatedAt
      : typeof data.updatedAt === "string"
        ? data.updatedAt
        : undefined;

  if (
    map === undefined &&
    mode === undefined &&
    currentPlayers === null &&
    status === undefined &&
    seq === null &&
    emittedAt === undefined &&
    updatedAt === undefined
  ) {
    return null;
  }

  return {
    map,
    mode,
    currentPlayers: currentPlayers === null ? undefined : currentPlayers,
    status,
    seq: seq === null ? undefined : seq,
    emittedAt,
    updatedAt,
  };
}

export function useLobbyServerTelemetry(params: {
  lobbyId: string;
  initialTelemetry?: ServerTelemetryState | null;
}) {
  const { lobbyId, initialTelemetry } = params;
  const channelName = lobbyId ? `lobby:${lobbyId}` : null;
  const eventName = "lobby:telemetry";
  const [serverTelemetry, setServerTelemetry] =
    useState<ServerTelemetryState | null>(initialTelemetry ?? null);
  const [receiveCount, setReceiveCount] = useState(0);
  const [lastUpdateAt, setLastUpdateAt] = useState<number | null>(() => {
    if (!initialTelemetry?.updatedAt) return null;
    const parsed = Date.parse(initialTelemetry.updatedAt);
    return Number.isNaN(parsed) ? null : parsed;
  });
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const [lastEventSeq, setLastEventSeq] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const clientRef = useRef<ReturnType<typeof createLobbyRealtimeClient> | null>(
    null
  );

  useEffect(() => {
    setServerTelemetry(initialTelemetry ?? null);
    if (initialTelemetry?.updatedAt) {
      const parsed = Date.parse(initialTelemetry.updatedAt);
      setLastUpdateAt(Number.isNaN(parsed) ? null : parsed);
    } else {
      setLastUpdateAt(null);
    }
  }, [initialTelemetry, lobbyId]);

  useEffect(() => {
    setLastEventAt(null);
    setLastEventSeq(null);
    setLastError(null);
  }, [lobbyId, channelName, eventName]);

  useEffect(() => {
    if (!lobbyId) return;
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/lobbies/${lobbyId}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const normalized = normalizeServerTelemetry(data);
        if (!normalized) return;
        setServerTelemetry(normalized);
        setLastEventAt(Date.now());
        setLastEventSeq(
          typeof normalized.seq === "number" ? normalized.seq : null
        );
        const nextUpdatedAt = normalized.updatedAt
          ? Date.parse(normalized.updatedAt)
          : Date.now();
        setLastUpdateAt(Number.isNaN(nextUpdatedAt) ? Date.now() : nextUpdatedAt);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lobbyId, channelName, eventName]);

  useEffect(() => {
    if (!lobbyId) return;
    const client = createLobbyRealtimeClient(lobbyId);
    clientRef.current = client;
    if (channelName) {
      console.debug("Ably subscribe", {
        lobbyId,
        channel: channelName,
        event: eventName,
      });
    }
    const channel = client.channels.get(channelName ?? `lobby:${lobbyId}`);

    const handleMessage = (message: { name?: string; data?: unknown }) => {
      if (message.name && message.name !== eventName) return;
      const normalized = normalizeServerTelemetry(message.data);
      if (!normalized) return;
      setReceiveCount((prev) => prev + 1);
      setServerTelemetry(normalized);
      setLastEventAt(Date.now());
      setLastEventSeq(
        typeof normalized.seq === "number" ? normalized.seq : null
      );
      setLastError(null);
      const nextUpdatedAt = normalized.updatedAt
        ? Date.parse(normalized.updatedAt)
        : Date.now();
      setLastUpdateAt(Number.isNaN(nextUpdatedAt) ? Date.now() : nextUpdatedAt);
    };

    const safeSubscribe = (
      fn: () => void | Promise<unknown>,
      label: string
    ) => {
      try {
        const result = fn();
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch((error) => {
            setLastError(formatError(error));
            console.warn("Ably subscribe failed", {
              lobbyId,
              label,
              error: formatError(error),
            });
          });
        }
      } catch (error) {
        setLastError(formatError(error));
        console.warn("Ably subscribe failed", {
          lobbyId,
          label,
          error: formatError(error),
        });
      }
    };

    safeSubscribe(() => channel.subscribe(eventName, handleMessage), eventName);

    return () => {
      try {
        channel.unsubscribe();
      } catch {
        // ignore
      }
      Promise.resolve()
        .then(() => client.close())
        .catch(() => {});
      clientRef.current = null;
    };
  }, [lobbyId, channelName, eventName]);

  return useMemo(
    () => ({
      serverTelemetry,
      receiveCount,
      lastUpdateAt,
      channelName,
      eventName,
      lastEventAt,
      lastEventSeq,
      lastError,
    }),
    [
      serverTelemetry,
      receiveCount,
      lastUpdateAt,
      channelName,
      eventName,
      lastEventAt,
      lastEventSeq,
      lastError,
    ]
  );
}
