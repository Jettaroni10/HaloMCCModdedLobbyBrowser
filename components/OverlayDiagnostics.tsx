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

  const ageMs = useMemo(() => {
    if (!telemetryState.localLastReceiveAt) return null;
    return Math.max(0, now - telemetryState.localLastReceiveAt);
  }, [telemetryState.localLastReceiveAt, now]);

  const serverAgeMs = useMemo(() => {
    if (!telemetryState.serverLastUpdateAt) return null;
    return Math.max(0, now - telemetryState.serverLastUpdateAt);
  }, [telemetryState.serverLastUpdateAt, now]);

  const isHost =
    Boolean(telemetryState.currentUserId) &&
    telemetryState.currentUserId === telemetryState.selectedLobbyHostId;

  const stale = useMemo(() => {
    if (!telemetryState.overlayConnected) return true;
    if (ageMs === null) return true;
    return ageMs > STALE_MS;
  }, [ageMs, telemetryState.overlayConnected]);

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
        <div>Selected lobby: {telemetryState.selectedLobbyId ?? "none"}</div>
        <div>Current user: {telemetryState.currentUserId ?? "none"}</div>
        <div>Lobby host: {telemetryState.selectedLobbyHostId ?? "none"}</div>
        <div>
          Telemetry source: {telemetryState.telemetrySource ?? "server"}
        </div>
        <div>Connected: {telemetryState.overlayConnected ? "yes" : "no"}</div>
        <div>
          Local seq: {Number(telemetryState.localTelemetry?.seq || 0)} · Server
          seq: {Number(telemetryState.serverTelemetry?.seq || 0)}
        </div>
        <div>
          Local age: {formatAge(ageMs)} · Server age: {formatAge(serverAgeMs)}
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
        {isHost && (
          <div>
            Last publish:{" "}
            {telemetryState.lastPublishStatus !== null
              ? telemetryState.lastPublishStatus
              : telemetryState.lastPublishAt
                ? "error"
                : "n/a"}{" "}
            · {formatAge(telemetryState.lastPublishAt ? now - telemetryState.lastPublishAt : null)}
          </div>
        )}
      </div>
    </div>
  );
}
