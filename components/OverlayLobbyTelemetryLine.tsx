"use client";

import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";

type OverlayLobbyTelemetryLineProps = {
  fallbackMode: string;
  fallbackMap: string;
  isHost: boolean;
  className?: string;
};

export default function OverlayLobbyTelemetryLine({
  fallbackMode,
  fallbackMap,
  isHost,
  className,
}: OverlayLobbyTelemetryLineProps) {
  const { isConnected, state } = useOverlayTelemetry();
  const liveMode =
    isHost && isConnected && state?.mode ? state.mode : fallbackMode;
  const liveMap = isHost && isConnected && state?.map ? state.map : fallbackMap;

  return (
    <p className={className}>
      {liveMode} · {liveMap}
    </p>
  );
}
