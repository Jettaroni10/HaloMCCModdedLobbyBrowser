"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  DEFAULT_OVERLAY_TELEMETRY_STATE,
  useOverlayTelemetryContext,
} from "@/components/OverlayTelemetryProvider";
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
  const { state: telemetryState, setState } = useOverlayTelemetryContext();
  const { liveBindingPreference } = useLiveBindingPreference(true);
  const publishThrottleMs = 500;
  const normalizedInitial = useMemo(
    () => normalizeTelemetryInput(initialServerTelemetry ?? null),
    [initialServerTelemetry]
  );
  const normalizedManual = useMemo(
    () => normalizeTelemetryInput(manualTelemetry ?? null),
    [manualTelemetry]
  );
  const {
    serverTelemetry,
    lastUpdateAt,
    channelName,
    eventName,
    lastEventAt,
    lastEventSeq,
    lastError,
  } = useLobbyServerTelemetry({
    lobbyId,
    initialTelemetry: normalizedInitial,
  });

  const isHost = Boolean(viewerUserId && viewerUserId === hostUserId);
  const liveBindingEnabled =
    isHost && telemetryState.overlayConnected && liveBindingPreference;
  const publishEnabled = isHost && liveBindingEnabled;
  const telemetrySource = !isHost
    ? "server"
    : liveBindingEnabled
      ? "local"
      : "manual";
  const displayTelemetry = !isHost
    ? serverTelemetry
    : liveBindingEnabled
      ? telemetryState.localTelemetry
      : normalizedManual;

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      selectedLobbyId: lobbyId,
      currentUserId: viewerUserId ?? null,
      selectedLobbyHostId: hostUserId,
      telemetrySource,
      liveBindingEnabled,
      serverTelemetry,
      manualTelemetry: normalizedManual,
      displayTelemetry,
      serverLastUpdateAt: lastUpdateAt,
      serverChannelName: channelName ?? null,
      serverEventName: eventName ?? null,
      serverLastEventAt: lastEventAt ?? null,
      serverLastEventSeq: lastEventSeq ?? null,
      serverLastError: lastError ?? null,
      lastPublishStatusCode: publishEnabled ? prev.lastPublishStatusCode : null,
      lastPublishAt: publishEnabled ? prev.lastPublishAt : null,
      lastPublishError: publishEnabled ? prev.lastPublishError : null,
      lastPublishedSeq: publishEnabled ? prev.lastPublishedSeq : null,
      publishTargetLobbyId: publishEnabled ? lobbyId : null,
    }));
  }, [
    lobbyId,
    viewerUserId,
    hostUserId,
    isHost,
    publishEnabled,
    telemetrySource,
    liveBindingEnabled,
    serverTelemetry,
    normalizedManual,
    displayTelemetry,
    lastUpdateAt,
    channelName,
    eventName,
    lastEventAt,
    lastEventSeq,
    lastError,
    setState,
  ]);

  useEffect(() => {
    return () => {
      setState((prev) => {
        if (prev.selectedLobbyId !== lobbyId) return prev;
        return {
          ...DEFAULT_OVERLAY_TELEMETRY_STATE,
          overlayConnected: prev.overlayConnected,
          localTelemetry: prev.localTelemetry,
          localLastReceiveAt: prev.localLastReceiveAt,
        };
      });
    };
  }, [lobbyId, setState]);

  const lastPublishedSeqRef = useRef<number | null>(null);
  const lastPublishAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!liveBindingEnabled) {
      lastPublishedSeqRef.current = null;
    }
  }, [liveBindingEnabled]);

  useEffect(() => {
    if (!isHost || !liveBindingEnabled || !telemetryState.localTelemetry) return;
    const seq =
      Number.isFinite(Number(telemetryState.localTelemetry.seq)) &&
      telemetryState.localTelemetry.seq !== undefined
        ? Number(telemetryState.localTelemetry.seq)
        : null;
    if (seq !== null && lastPublishedSeqRef.current === seq) return;
    const now = Date.now();
    if (
      lastPublishAtRef.current !== null &&
      now - lastPublishAtRef.current < publishThrottleMs
    ) {
      return;
    }
    if (seq !== null) lastPublishedSeqRef.current = seq;
    lastPublishAtRef.current = now;

    const payload = {
      mapName: telemetryState.localTelemetry.map ?? null,
      modeName: telemetryState.localTelemetry.mode ?? null,
      playerCount:
        typeof telemetryState.localTelemetry.currentPlayers === "number"
          ? telemetryState.localTelemetry.currentPlayers
          : null,
      status: telemetryState.localTelemetry.status ?? null,
      seq,
      emittedAt: telemetryState.localTelemetry.emittedAt ?? null,
    };

    fetch(`/api/lobbies/${lobbyId}/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        setState((prev) => ({
          ...prev,
          lastPublishStatusCode: response.status,
          lastPublishAt: Date.now(),
          lastPublishError: response.ok ? null : `HTTP ${response.status}`,
          lastPublishedSeq: seq,
          publishTargetLobbyId: lobbyId,
        }));
      })
      .catch((error) => {
        setState((prev) => ({
          ...prev,
          lastPublishStatusCode: null,
          lastPublishAt: Date.now(),
          lastPublishError:
            error instanceof Error ? error.message : String(error),
          lastPublishedSeq: seq,
          publishTargetLobbyId: lobbyId,
        }));
      });
  }, [
    isHost,
    liveBindingEnabled,
    telemetryState.localTelemetry,
    lobbyId,
    publishThrottleMs,
    setState,
  ]);

  return null;
}
