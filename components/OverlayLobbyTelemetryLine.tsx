"use client";

import { useOverlayTelemetryContext } from "@/components/OverlayTelemetryProvider";

type OverlayLobbyTelemetryLineProps = {
  fallbackMode: string;
  fallbackMap: string;
  lobbyId?: string;
  selected?: boolean;
  className?: string;
  as?: "p" | "span";
  prefix?: string;
};

export default function OverlayLobbyTelemetryLine({
  fallbackMode,
  fallbackMap,
  lobbyId,
  selected = false,
  className,
  as = "p",
  prefix,
}: OverlayLobbyTelemetryLineProps) {
  const { state: telemetryState } = useOverlayTelemetryContext();
  const useContextTelemetry =
    selected && lobbyId && telemetryState.selectedLobbyId === lobbyId;
  const displayTelemetry = useContextTelemetry
    ? telemetryState.displayTelemetry
    : null;
  const hasLiveTelemetry = Boolean(useContextTelemetry && displayTelemetry);
  const liveMode = displayTelemetry?.mode ?? fallbackMode;
  const liveMap = displayTelemetry?.map ?? fallbackMap;
  const mapLower = String(displayTelemetry?.map ?? "").trim().toLowerCase();
  const inMenus = hasLiveTelemetry && (!mapLower || mapLower === "unknown");

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
