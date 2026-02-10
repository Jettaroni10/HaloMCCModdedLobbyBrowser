"use client";

import { useEffect, useMemo, useState } from "react";
import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";

const DEBUG_KEY = "hmcc_overlay_debug";
const STALE_MS = 2000;

function formatAge(ms: number | null) {
  if (ms === null) return "Never";
  if (ms < 0) return "0ms";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
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

export default function OverlayDiagnostics() {
  const { isConnected, state, receiveCount, lastReceiveAt } =
    useOverlayTelemetry() as ReturnType<typeof useOverlayTelemetry> & {
      receiveCount: number;
      lastReceiveAt: number | null;
    };

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
    if (!lastReceiveAt) return null;
    return Math.max(0, now - lastReceiveAt);
  }, [lastReceiveAt, now]);

  const stale = useMemo(() => {
    if (!isConnected) return true;
    if (ageMs === null) return true;
    return ageMs > STALE_MS;
  }, [ageMs, isConnected]);

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
        <div>Connected: {isConnected ? "yes" : "no"}</div>
        <div>IPC recv: {receiveCount}</div>
        <div>Last recv: {formatAge(ageMs)}</div>
        <div>Seq: {Number(state?.seq || 0)}</div>
        <div>Status: {state?.status || "unknown"}</div>
        <div>
          Parse OK:{" "}
          {state?.parseOk === null || state?.parseOk === undefined
            ? "n/a"
            : state.parseOk
              ? "yes"
              : "no"}
        </div>
        <div>Consecutive parse errors: {formatNullableNumber(state?.consecutiveParseErrors)}</div>
        <div>Last good age: {formatNullableNumber(state?.lastGoodAgeMs)}ms</div>
        <div>File mtime: {formatNullableNumber(state?.telemetryFileMtimeMs)}ms</div>
        <div>Last parse error: {trimError(state?.lastParseError)}</div>
        <div>Map: {state?.map || "Unknown"}</div>
        <div>Mode: {state?.mode || "Unknown"}</div>
        <div>
          Players:{" "}
          {Number.isFinite(Number(state?.currentPlayers))
            ? Number(state?.currentPlayers)
            : 0}
        </div>
        {state?.debug ? <div>Reader debug: present</div> : <div>Reader debug: none</div>}
      </div>
    </div>
  );
}
