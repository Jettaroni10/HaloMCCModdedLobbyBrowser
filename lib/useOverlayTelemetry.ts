"use client";

import { useEffect, useMemo, useState } from "react";

export type OverlayTelemetryState = {
  status?: string;
  map?: string;
  mode?: string;
  currentPlayers?: number;
  maxPlayers?: number;
  hostName?: string;
  requiredMods?: string[];
  sessionId?: string;
  timestamp?: string | number | null;
  lastUpdatedAt?: string | number | null;
  seq?: number;
  emittedAt?: string;
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

  return {
    status: typeof input.status === "string" ? input.status : undefined,
    map,
    mode,
    currentPlayers,
    maxPlayers,
    hostName: typeof input.hostName === "string" ? input.hostName : undefined,
    requiredMods: Array.isArray(input.requiredMods) ? input.requiredMods : [],
    sessionId: typeof input.sessionId === "string" ? input.sessionId : "",
    timestamp: input.timestamp ?? null,
    lastUpdatedAt: input.lastUpdatedAt ?? null,
  } satisfies OverlayTelemetryState;
}

export function useOverlayTelemetry() {
  const [connection, setConnection] =
    useState<OverlayTelemetryConnection>("disconnected");
  const [state, setState] = useState<OverlayTelemetryState | null>(null);
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
      setState(normalizeTelemetry(payload));
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
      state,
      isConnected: connection === "connected",
      receiveCount,
      lastReceiveAt,
    }),
    [connection, state, receiveCount, lastReceiveAt]
  );

  return memoized;
}
