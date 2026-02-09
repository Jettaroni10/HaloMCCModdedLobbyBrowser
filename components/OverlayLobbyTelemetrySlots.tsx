"use client";

import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";

type OverlayLobbyTelemetrySlotsProps = {
  fallbackCurrentPlayers: number;
  fallbackMaxPlayers: number;
  isHost: boolean;
  className?: string;
};

export default function OverlayLobbyTelemetrySlots({
  fallbackCurrentPlayers,
  fallbackMaxPlayers,
  isHost,
  className,
}: OverlayLobbyTelemetrySlotsProps) {
  const { isConnected, state } = useOverlayTelemetry();
  const hasLive =
    isHost &&
    isConnected &&
    typeof state?.currentPlayers === "number";
  const liveCurrent = hasLive
    ? Math.max(0, Number(state?.currentPlayers ?? 0))
    : fallbackCurrentPlayers;
  const liveMax = Number.isFinite(fallbackMaxPlayers) ? fallbackMaxPlayers : 0;
  const slotsAvailable = Math.max(0, Math.min(liveMax, liveMax - liveCurrent));

  return (
    <span className={className}>
      Players {liveCurrent}/{liveMax} · Slots {slotsAvailable}
    </span>
  );
}
