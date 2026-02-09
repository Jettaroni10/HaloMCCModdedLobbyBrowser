"use client";

import { useEffect, useMemo, useState } from "react";
import FadeInImage from "./FadeInImage";
import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";
import { getLobbyBgImage } from "@/lib/maps/reachMapImages";

type LobbyBackgroundProps = {
  lobbyId: string;
  hasRealImage: boolean;
  fallbackMapName: string;
  isHost: boolean;
  fallbackUrl?: string;
};

export default function LobbyBackground({
  lobbyId,
  hasRealImage,
  fallbackMapName,
  isHost,
  fallbackUrl,
}: LobbyBackgroundProps) {
  const [url, setUrl] = useState<string | null>(null);
  const { isConnected, state } = useOverlayTelemetry();
  const telemetryMapName =
    isHost && isConnected && state?.map ? state.map : null;
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
    <>
      <img
        src={fallbackImage}
        alt="Lobby map background"
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      />
      {showRealImage && url && (
        <FadeInImage
          src={url}
          alt=""
          className="fixed inset-0 -z-20 h-full w-full object-cover"
        />
      )}
      <div className={`fixed inset-0 -z-10 ${baseTint}`} />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: vignette,
        }}
      />
    </>
  );
}
