"use client";

import { useEffect, useMemo, useState } from "react";
import { useOverlayTelemetryContext } from "@/components/OverlayTelemetryProvider";

const DEBUG_KEY = "hmcc_overlay_debug";
const STALE_MS = 2000;

function formatAge(ms: number | null) {
  if (ms === null) return "Never";
  if (ms < 0) return "0ms";
  return `${ms}ms`;
}

function formatNullableNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? String(n) : "n/a";
}

function trimError(value: unknown) {
  const s = typeof value === "string" ? value : "";
  if (!s) return "none";
  const compact = s.replace(/\s+/g, " ").trim();
  return compact.length > 120 ? `${compact.slice(0, 120)}…` : compact;
}

function formatCarry(flag: boolean | null | undefined) {
  return flag === false ? " (carried)" : "";
}

function parseTimestamp(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export default function OverlayDiagnostics() {
  const { state: telemetryState } = useOverlayTelemetryContext();

  const [enabled, setEnabled] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    if (!bridge) return;
    const stored = localStorage.getItem(DEBUG_KEY);
    const nextEnabled = stored === "1";
    setEnabled(nextEnabled);
    const overlay = bridge as { setDebugPanelPinned?: (enabled: boolean) => void };
    if (typeof overlay.setDebugPanelPinned === "function") {
      overlay.setDebugPanelPinned(nextEnabled);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [enabled]);

  const localReceiveAgeMs = useMemo(() => {
    if (!telemetryState.localLastReceiveAt) return null;
    return Math.max(0, now - telemetryState.localLastReceiveAt);
  }, [telemetryState.localLastReceiveAt, now]);

  const serverUpdateAgeMs = useMemo(() => {
    if (!telemetryState.serverLastUpdateAt) return null;
    return Math.max(0, now - telemetryState.serverLastUpdateAt);
  }, [telemetryState.serverLastUpdateAt, now]);

  const isHost =
    Boolean(telemetryState.currentUserId) &&
    telemetryState.currentUserId === telemetryState.selectedLobbyHostId;

  const stale = useMemo(() => {
    if (!telemetryState.overlayConnected) return true;
    if (localReceiveAgeMs === null) return true;
    return localReceiveAgeMs > STALE_MS;
  }, [localReceiveAgeMs, telemetryState.overlayConnected]);

  const displayTimestampMs = useMemo(() => {
    const source =
      telemetryState.displayTelemetry?.emittedAt ??
      telemetryState.displayTelemetry?.updatedAt;
    return parseTimestamp(source);
  }, [telemetryState.displayTelemetry?.emittedAt, telemetryState.displayTelemetry?.updatedAt]);

  const displayAgeMs = useMemo(() => {
    if (displayTimestampMs === null) return null;
    return Math.max(0, now - displayTimestampMs);
  }, [displayTimestampMs, now]);

  const serverEmittedAtMs = useMemo(() => {
    return parseTimestamp(telemetryState.serverTelemetry?.emittedAt);
  }, [telemetryState.serverTelemetry?.emittedAt]);

  const serverAgeMs = useMemo(() => {
    if (serverEmittedAtMs === null) return null;
    return Math.max(0, now - serverEmittedAtMs);
  }, [serverEmittedAtMs, now]);

  const localEmittedAtMs = useMemo(() => {
    return parseTimestamp(telemetryState.localTelemetry?.emittedAt);
  }, [telemetryState.localTelemetry?.emittedAt]);

  if (!enabled) {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    if (!bridge) return null;
    return (
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(DEBUG_KEY, "1");
          setEnabled(true);
          const overlay = bridge as { setDebugPanelPinned?: (enabled: boolean) => void };
          if (typeof overlay.setDebugPanelPinned === "function") {
            overlay.setDebugPanelPinned(true);
          }
        }}
        className="fixed bottom-2 left-3 z-50 rounded-sm border border-ink/20 bg-sand/70 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-ink/65"
      >
        Debug: Off
      </button>
    );
  }

  return (
    <div
      id="hmcc-overlay-diagnostics"
      className="fixed bottom-2 left-3 z-50 w-[320px] rounded-sm border border-ink/20 bg-sand/80 p-2 text-[10px] font-semibold tracking-[0.12em] text-ink/70"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              stale ? "bg-rose-500" : "bg-emerald-400"
            }`}
          />
          <span>Debug</span>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DEBUG_KEY, "0");
            setEnabled(false);
            const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
            const overlay = bridge as { setDebugPanelPinned?: (enabled: boolean) => void };
            if (typeof overlay.setDebugPanelPinned === "function") {
              overlay.setDebugPanelPinned(false);
            }
          }}
          className="rounded-sm border border-ink/20 bg-sand px-2 py-0.5 text-[10px] font-semibold text-ink/70"
        >
          Off
        </button>
      </div>

      <div className="mt-2 space-y-1 text-ink/70">
        <div className="text-ink/80">Lobby Telemetry Debug</div>
        <div>Selected lobby: {telemetryState.selectedLobbyId ?? "none"}</div>
        <div>Current user: {telemetryState.currentUserId ?? "none"}</div>
        <div>Lobby host: {telemetryState.selectedLobbyHostId ?? "none"}</div>
        <div>Is host: {isHost ? "yes" : "no"}</div>
        <div>
          Live binding: {telemetryState.liveBindingEnabled ? "on" : "off"}
        </div>
        <div>
          Telemetry source: {telemetryState.telemetrySource ?? "server"}
        </div>
        <div>
          Display map: {telemetryState.displayTelemetry?.map ?? "n/a"} · mode:{" "}
          {telemetryState.displayTelemetry?.mode ?? "n/a"} · players:{" "}
          {formatNullableNumber(
            telemetryState.displayTelemetry?.currentPlayers
          )}
        </div>
        <div>
          Display status: {telemetryState.displayTelemetry?.status ?? "n/a"} ·
          seq: {formatNullableNumber(telemetryState.displayTelemetry?.seq)} ·
          age: {formatAge(displayAgeMs)}
        </div>
        <div>
          Server map: {telemetryState.serverTelemetry?.map ?? "n/a"} · mode:{" "}
          {telemetryState.serverTelemetry?.mode ?? "n/a"} · players:{" "}
          {formatNullableNumber(
            telemetryState.serverTelemetry?.currentPlayers
          )}
        </div>
        <div>
          Server status: {telemetryState.serverTelemetry?.status ?? "n/a"} · seq:{" "}
          {formatNullableNumber(telemetryState.serverTelemetry?.seq)}
        </div>
        <div>
          Server emittedAt: {telemetryState.serverTelemetry?.emittedAt ?? "n/a"} ·
          age: {formatAge(serverAgeMs)}
        </div>
        <div>
          Server last event:{" "}
          {telemetryState.serverLastEventAt
            ? new Date(telemetryState.serverLastEventAt).toISOString()
            : "n/a"}{" "}
          · seq: {formatNullableNumber(telemetryState.serverLastEventSeq)}
        </div>
        <div>
          Server channel: {telemetryState.serverChannelName ?? "n/a"} · event:{" "}
          {telemetryState.serverEventName ?? "n/a"}
        </div>
        <div>Server last error: {trimError(telemetryState.serverLastError)}</div>
        <div>
          Local map: {telemetryState.localTelemetry?.map ?? "n/a"} · mode:{" "}
          {telemetryState.localTelemetry?.mode ?? "n/a"} · players:{" "}
          {formatNullableNumber(telemetryState.localTelemetry?.currentPlayers)}
        </div>
        <div>
          Local status: {telemetryState.localTelemetry?.status ?? "n/a"} · seq:{" "}
          {formatNullableNumber(telemetryState.localTelemetry?.seq)} · emittedAt:{" "}
          {telemetryState.localTelemetry?.emittedAt ?? "n/a"}
        </div>
        <div>
          Publish target:{" "}
          {isHost ? telemetryState.publishTargetLobbyId ?? "n/a" : "n/a"}
        </div>
        <div>
          Last publish status:{" "}
          {isHost
            ? formatNullableNumber(telemetryState.lastPublishStatusCode)
            : "n/a"}{" "}
          · at:{" "}
          {isHost && telemetryState.lastPublishAt
            ? new Date(telemetryState.lastPublishAt).toISOString()
            : "n/a"}{" "}
          · age:{" "}
          {isHost
            ? formatAge(
                telemetryState.lastPublishAt
                  ? now - telemetryState.lastPublishAt
                  : null
              )
            : "n/a"}
        </div>
        <div>
          Last publish seq:{" "}
          {isHost
            ? formatNullableNumber(telemetryState.lastPublishedSeq)
            : "n/a"}
        </div>
        <div>
          Last publish error:{" "}
          {isHost ? trimError(telemetryState.lastPublishError) : "n/a"}
        </div>

        <div className="mt-2 border-t border-ink/10 pt-2 text-ink/80">
          Local Telemetry (Reader)
        </div>
        <div>Connected: {telemetryState.overlayConnected ? "yes" : "no"}</div>
        <div>
          Local seq: {Number(telemetryState.localTelemetry?.seq || 0)} · Server
          seq: {Number(telemetryState.serverTelemetry?.seq || 0)}
        </div>
        <div>
          Local age: {formatAge(localReceiveAgeMs)} · Server update age:{" "}
          {formatAge(serverUpdateAgeMs)}
        </div>
        <div>Status: {telemetryState.localTelemetry?.status || "unknown"}</div>
        <div>
          Parse OK:{" "}
          {telemetryState.localTelemetry?.parseOk === null ||
          telemetryState.localTelemetry?.parseOk === undefined
            ? "n/a"
            : telemetryState.localTelemetry.parseOk
              ? "yes"
              : "no"}
        </div>
        <div>
          Consecutive parse errors:{" "}
          {formatNullableNumber(
            telemetryState.localTelemetry?.consecutiveParseErrors
          )}
        </div>
        <div>
          Last good age:{" "}
          {formatNullableNumber(telemetryState.localTelemetry?.lastGoodAgeMs)}ms
        </div>
        <div>
          File mtime:{" "}
          {formatNullableNumber(
            telemetryState.localTelemetry?.telemetryFileMtimeMs
          )}
          ms
        </div>
        <div>
          Last parse error: {trimError(telemetryState.localTelemetry?.lastParseError)}
        </div>
        <div>
          Map: {telemetryState.localTelemetry?.map || "Unknown"}
          {formatCarry(telemetryState.localTelemetry?.mapUpdatedThisTick)}
        </div>
        <div>
          Mode: {telemetryState.localTelemetry?.mode || "Unknown"}
          {formatCarry(telemetryState.localTelemetry?.modeUpdatedThisTick)}
        </div>
        <div>
          Players:{" "}
          {Number.isFinite(Number(telemetryState.localTelemetry?.currentPlayers))
            ? Number(telemetryState.localTelemetry?.currentPlayers)
            : 0}
          {formatCarry(telemetryState.localTelemetry?.playersUpdatedThisTick)}
        </div>
        {telemetryState.localTelemetry?.debug ? (
          <div>Reader debug: present</div>
        ) : (
          <div>Reader debug: none</div>
        )}
        <div>
          Local emitted age:{" "}
          {formatAge(
            localEmittedAtMs === null
              ? null
              : Math.max(0, now - localEmittedAtMs)
          )}
        </div>
      </div>
    </div>
  );
}
