"use client";

import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";

type OverlayLobbyTelemetryLineProps = {
  fallbackMode: string;
  fallbackMap: string;
  isHost: boolean;
  className?: string;
  as?: "p" | "span";
  prefix?: string;
};

export default function OverlayLobbyTelemetryLine({
  fallbackMode,
  fallbackMap,
  isHost,
  className,
  as = "p",
  prefix,
}: OverlayLobbyTelemetryLineProps) {
  const { isConnected, state } = useOverlayTelemetry();
  const liveMode =
    isHost && isConnected && state?.mode ? state.mode : fallbackMode;
  const liveMap =
    isHost && isConnected && state?.map ? state.map : fallbackMap;
  const mapLower = String(state?.map ?? "").trim().toLowerCase();
  const inMenus =
    isHost && isConnected && (!mapLower || mapLower === "unknown");

  const content = inMenus
    ? "Lobby in menus"
    : prefix
    ? `${prefix} · ${liveMode} · ${liveMap}`
    : `${liveMode} · ${liveMap}`;

  if (as === "span") {
    return <span className={className}>{content}</span>;
  }

  return <p className={className}>{content}</p>;
}
