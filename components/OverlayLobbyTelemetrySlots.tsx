"use client";

import { useOverlayTelemetryContext } from "@/components/OverlayTelemetryProvider";

type OverlayLobbyTelemetrySlotsProps = {
  fallbackCurrentPlayers: number;
  fallbackMaxPlayers: number;
  lobbyId?: string;
  selected?: boolean;
  className?: string;
};

export default function OverlayLobbyTelemetrySlots({
  fallbackCurrentPlayers,
  fallbackMaxPlayers,
  lobbyId,
  selected = false,
  className,
}: OverlayLobbyTelemetrySlotsProps) {
  const { state: telemetryState } = useOverlayTelemetryContext();
  const useContextTelemetry =
    selected && lobbyId && telemetryState.selectedLobbyId === lobbyId;
  const displayTelemetry = useContextTelemetry
    ? telemetryState.displayTelemetry
    : null;
  const liveCurrent =
    displayTelemetry && typeof displayTelemetry.currentPlayers === "number"
      ? Math.max(0, Number(displayTelemetry.currentPlayers ?? 0))
      : fallbackCurrentPlayers;
  const liveMax = Number.isFinite(fallbackMaxPlayers) ? fallbackMaxPlayers : 0;
  const slotsAvailable = Math.max(0, Math.min(liveMax, liveMax - liveCurrent));

  return (
    <span className={className}>
      Players {liveCurrent}/{liveMax} · Slots {slotsAvailable}
    </span>
  );
}
