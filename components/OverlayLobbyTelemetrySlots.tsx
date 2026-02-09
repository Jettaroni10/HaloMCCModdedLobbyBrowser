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
    typeof state?.maxPlayers === "number" &&
    state.maxPlayers > 0;
  const liveCurrent = hasLive
    ? Math.max(0, Number(state?.currentPlayers ?? 0))
    : fallbackCurrentPlayers;
  const liveMax = hasLive ? Number(state?.maxPlayers ?? 0) : fallbackMaxPlayers;

  return (
    <span className={className}>
      Slots {liveCurrent}/{liveMax}
    </span>
  );
}
