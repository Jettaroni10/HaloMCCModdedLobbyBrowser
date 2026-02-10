"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_OVERLAY_TELEMETRY_STATE,
  useOverlayTelemetryContext,
} from "@/components/OverlayTelemetryProvider";
import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";
import { useLiveBindingPreference } from "@/lib/useLiveBindingPreference";
import { useLobbyServerTelemetry } from "@/lib/useLobbyServerTelemetry";

type SelectedLobbyTelemetryBridgeProps = {
  lobbyId: string;
  hostUserId: string;
  viewerUserId: string | null;
  manualTelemetry?: {
    map?: string | null;
    mode?: string | null;
    currentPlayers?: number | null;
  } | null;
  initialServerTelemetry?: {
    map?: string | null;
    mode?: string | null;
    currentPlayers?: number | null;
    status?: string | null;
    seq?: number | null;
    emittedAt?: string | null;
    updatedAt?: string | null;
  } | null;
};

function normalizeTelemetryInput(
  telemetry:
    | SelectedLobbyTelemetryBridgeProps["initialServerTelemetry"]
    | SelectedLobbyTelemetryBridgeProps["manualTelemetry"]
) {
  if (!telemetry) return null;
  const next = {
    map: typeof telemetry.map === "string" ? telemetry.map : undefined,
    mode: typeof telemetry.mode === "string" ? telemetry.mode : undefined,
    currentPlayers:
      typeof telemetry.currentPlayers === "number"
        ? telemetry.currentPlayers
        : undefined,
    status: typeof telemetry.status === "string" ? telemetry.status : undefined,
    seq: typeof telemetry.seq === "number" ? telemetry.seq : undefined,
    emittedAt:
      typeof telemetry.emittedAt === "string" ? telemetry.emittedAt : undefined,
    updatedAt:
      typeof telemetry.updatedAt === "string" ? telemetry.updatedAt : undefined,
  };

  if (
    next.map === undefined &&
    next.mode === undefined &&
    next.currentPlayers === undefined &&
    next.status === undefined &&
    next.seq === undefined &&
    next.emittedAt === undefined &&
    next.updatedAt === undefined
  ) {
    return null;
  }

  return next;
}

export default function SelectedLobbyTelemetryBridge({
  lobbyId,
  hostUserId,
  viewerUserId,
  manualTelemetry,
  initialServerTelemetry,
}: SelectedLobbyTelemetryBridgeProps) {
  const { setState } = useOverlayTelemetryContext();
  const { isConnected, localTelemetry, lastReceiveAt } = useOverlayTelemetry();
  const { liveBindingPreference } = useLiveBindingPreference(true);
  const normalizedInitial = useMemo(
    () => normalizeTelemetryInput(initialServerTelemetry ?? null),
    [initialServerTelemetry]
  );
  const normalizedManual = useMemo(
    () => normalizeTelemetryInput(manualTelemetry ?? null),
    [manualTelemetry]
  );
  const { serverTelemetry, lastUpdateAt } = useLobbyServerTelemetry({
    lobbyId,
    initialTelemetry: normalizedInitial,
  });

  const isHost = Boolean(viewerUserId && viewerUserId === hostUserId);
  const liveBindingEnabled = isHost && isConnected && liveBindingPreference;
  const telemetrySource = liveBindingEnabled ? "local" : "server";
  const resolvedServerTelemetry =
    !liveBindingEnabled && isHost && normalizedManual
      ? normalizedManual
      : serverTelemetry;

  useEffect(() => {
    setState({
      selectedLobbyId: lobbyId,
      telemetrySource,
      liveBindingEnabled,
      localTelemetry,
      serverTelemetry: resolvedServerTelemetry,
      localLastReceiveAt: lastReceiveAt,
      serverLastUpdateAt: lastUpdateAt,
    });
  }, [
    lobbyId,
    telemetrySource,
    liveBindingEnabled,
    localTelemetry,
    resolvedServerTelemetry,
    lastReceiveAt,
    lastUpdateAt,
    setState,
  ]);

  useEffect(() => {
    return () => {
      setState((prev) =>
        prev.selectedLobbyId === lobbyId ? DEFAULT_OVERLAY_TELEMETRY_STATE : prev
      );
    };
  }, [lobbyId, setState]);

  const lastPublishedSeqRef = useRef<number | null>(null);

  useEffect(() => {
    if (!liveBindingEnabled) {
      lastPublishedSeqRef.current = null;
    }
  }, [liveBindingEnabled]);

  useEffect(() => {
    if (!isHost || !liveBindingEnabled || !localTelemetry) return;
    const seq =
      Number.isFinite(Number(localTelemetry.seq)) && localTelemetry.seq !== undefined
        ? Number(localTelemetry.seq)
        : null;
    if (seq !== null && lastPublishedSeqRef.current === seq) return;
    if (seq !== null) {
      lastPublishedSeqRef.current = seq;
    }

    const payload = {
      mapName: localTelemetry.map ?? null,
      modeName: localTelemetry.mode ?? null,
      playerCount:
        typeof localTelemetry.currentPlayers === "number"
          ? localTelemetry.currentPlayers
          : null,
      status: localTelemetry.status ?? null,
      seq,
      emittedAt: localTelemetry.emittedAt ?? null,
    };

    fetch(`/api/lobbies/${lobbyId}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [isHost, liveBindingEnabled, localTelemetry, lobbyId]);

  return null;
}
