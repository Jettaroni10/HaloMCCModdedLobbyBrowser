"use client";

import { useEffect, useMemo, useState } from "react";
import FadeInImage from "./FadeInImage";
import { useOverlayTelemetryContext } from "@/components/OverlayTelemetryProvider";
import { getLobbyBgImage } from "@/lib/maps/reachMapImages";

type LobbyBackgroundPanProps = {
  lobbyId: string;
  hasRealImage: boolean;
  fallbackMapName: string;
  selected?: boolean;
  fallbackUrl?: string;
  children: React.ReactNode;
};

export default function LobbyBackgroundPan({
  lobbyId,
  hasRealImage,
  fallbackMapName,
  selected = false,
  fallbackUrl,
  children,
}: LobbyBackgroundPanProps) {
  const [url, setUrl] = useState<string | null>(null);
  const { state: telemetryState } = useOverlayTelemetryContext();
  const useContextTelemetry =
    selected && telemetryState.selectedLobbyId === lobbyId;
  const displayTelemetry = useContextTelemetry
    ? telemetryState.displayTelemetry
    : null;
  const telemetryMapName = displayTelemetry?.map ?? null;
  const resolvedFallback = useMemo(
    () =>
      getLobbyBgImage({
        customImageUrl: null,
        telemetryMapName,
        fallbackMapName,
      }),
    [telemetryMapName, fallbackMapName]
  );
  const fallbackImage = fallbackUrl ?? resolvedFallback;

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch(`/api/lobbies/${lobbyId}/map-image`);
      if (!response.ok) {
        if (active) setUrl(null);
        return;
      }
      const payload = (await response.json()) as { url?: string | null };
      if (active) setUrl(payload.url ?? null);
    }
    void load();
    return () => {
      active = false;
    };
  }, [lobbyId]);

  const showRealImage = hasRealImage && Boolean(url);
  const baseTint = showRealImage ? "bg-black/5" : "bg-[#081826]/35";
  const vignette = showRealImage
    ? "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.02), rgba(0,0,0,0.25) 70%)"
    : "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.2), rgba(0,0,0,0.6) 70%)";

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 lobby-bg-pan">
          <img
            src={fallbackImage}
            alt="Lobby map background"
            className="absolute inset-0 h-full w-full object-cover"
          />
          {showRealImage && url && (
            <FadeInImage
              src={url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
        <div className={`absolute inset-0 z-10 ${baseTint}`} />
        <div
          className="absolute inset-0 z-10"
          style={{
            background: vignette,
          }}
        />
      </div>
      <div className="relative z-20">{children}</div>
    </div>
  );
}
