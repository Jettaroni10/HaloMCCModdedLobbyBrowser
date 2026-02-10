"use client";

import { useEffect, useMemo, useState } from "react";

export type OverlayTelemetryState = {
  status?: string;
  map?: string;
  mode?: string;
  currentPlayers?: number;
  maxPlayers?: number;
  mapUpdatedThisTick?: boolean | null;
  modeUpdatedThisTick?: boolean | null;
  playersUpdatedThisTick?: boolean | null;
  hostName?: string;
  requiredMods?: string[];
  sessionId?: string;
  timestamp?: string | number | null;
  lastUpdatedAt?: string | number | null;
  seq?: number;
  emittedAt?: string;
  parseOk?: boolean | null;
  lastParseError?: string | null;
  consecutiveParseErrors?: number;
  lastGoodAgeMs?: number | null;
  telemetryFileMtimeMs?: number | null;
  debug?: unknown;
};

export type OverlayTelemetryConnection = "connected" | "disconnected";

type OverlayBridge = {
  getState: () => Promise<OverlayTelemetryState | null>;
  subscribe: (cb: (state: OverlayTelemetryState | null) => void) => () => void;
};

function normalizeTelemetry(input: OverlayTelemetryState | null) {
  if (!input || typeof input !== "object") return null;
  const map = typeof input.map === "string" ? input.map : "Unknown";
  const mode = typeof input.mode === "string" ? input.mode : "Unknown";
  const currentPlayers = Number.isFinite(Number(input.currentPlayers))
    ? Number(input.currentPlayers)
    : 0;
  const maxPlayers = Number.isFinite(Number(input.maxPlayers))
    ? Number(input.maxPlayers)
    : 0;
  const seq = Number.isFinite(Number(input.seq)) ? Number(input.seq) : 0;
  const emittedAt = typeof input.emittedAt === "string" ? input.emittedAt : undefined;
  const parseOk =
    input.parseOk === null || input.parseOk === undefined
      ? null
      : Boolean(input.parseOk);
  const consecutiveParseErrors = Number.isFinite(Number(input.consecutiveParseErrors))
    ? Number(input.consecutiveParseErrors)
    : 0;
  const lastGoodAgeMs = Number.isFinite(Number(input.lastGoodAgeMs))
    ? Number(input.lastGoodAgeMs)
    : input.lastGoodAgeMs === null
      ? null
      : null;
  const telemetryFileMtimeMs = Number.isFinite(Number(input.telemetryFileMtimeMs))
    ? Number(input.telemetryFileMtimeMs)
    : input.telemetryFileMtimeMs === null
      ? null
      : null;
  const lastParseError =
    typeof input.lastParseError === "string" ? input.lastParseError : null;
  const mapUpdatedThisTick =
    input.mapUpdatedThisTick === null || input.mapUpdatedThisTick === undefined
      ? null
      : Boolean(input.mapUpdatedThisTick);
  const modeUpdatedThisTick =
    input.modeUpdatedThisTick === null || input.modeUpdatedThisTick === undefined
      ? null
      : Boolean(input.modeUpdatedThisTick);
  const playersUpdatedThisTick =
    input.playersUpdatedThisTick === null ||
    input.playersUpdatedThisTick === undefined
      ? null
      : Boolean(input.playersUpdatedThisTick);

  return {
    status: typeof input.status === "string" ? input.status : undefined,
    map,
    mode,
    currentPlayers,
    maxPlayers,
    mapUpdatedThisTick,
    modeUpdatedThisTick,
    playersUpdatedThisTick,
    hostName: typeof input.hostName === "string" ? input.hostName : undefined,
    requiredMods: Array.isArray(input.requiredMods) ? input.requiredMods : [],
    sessionId: typeof input.sessionId === "string" ? input.sessionId : "",
    timestamp: input.timestamp ?? null,
    lastUpdatedAt: input.lastUpdatedAt ?? null,
    seq,
    emittedAt,
    parseOk,
    lastParseError,
    consecutiveParseErrors,
    lastGoodAgeMs,
    telemetryFileMtimeMs,
  } satisfies OverlayTelemetryState;
}

export function useOverlayTelemetry() {
  const [connection, setConnection] =
    useState<OverlayTelemetryConnection>("disconnected");
  const [localTelemetry, setLocalTelemetry] = useState<OverlayTelemetryState | null>(null);
  const [receiveCount, setReceiveCount] = useState(0);
  const [lastReceiveAt, setLastReceiveAt] = useState<number | null>(null);

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: OverlayBridge })
      ?.hmccOverlay;
    if (!bridge || typeof bridge.getState !== "function") {
      setConnection("disconnected");
      return;
    }

    setConnection("connected");
    let unsubscribe: (() => void) | null = null;

    const handleUpdate = (payload: OverlayTelemetryState | null) => {
      setReceiveCount((prev) => prev + 1);
      setLastReceiveAt(Date.now());
      setLocalTelemetry(normalizeTelemetry(payload));
    };

    bridge
      .getState()
      .then((payload) => handleUpdate(payload))
      .catch(() => {});

    if (typeof bridge.subscribe === "function") {
      unsubscribe = bridge.subscribe(handleUpdate);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const memoized = useMemo(
    () => ({
      connection,
      localTelemetry,
      isConnected: connection === "connected",
      receiveCount,
      lastReceiveAt,
    }),
    [connection, localTelemetry, receiveCount, lastReceiveAt]
  );

  return memoized;
}
