"use client";

import { useEffect, useMemo, useState } from "react";
import FadeInImage from "./FadeInImage";
import { useOverlayTelemetry } from "@/lib/useOverlayTelemetry";
import { getLobbyBgImage } from "@/lib/maps/reachMapImages";

type LobbyCardBackgroundProps = {
  imageUrl?: string | null;
  fallbackMapName?: string | null;
  isHost?: boolean;
};

export default function LobbyCardBackground({
  imageUrl,
  fallbackMapName,
  isHost = false,
}: LobbyCardBackgroundProps) {
  const [failed, setFailed] = useState(false);
  const { isConnected, state } = useOverlayTelemetry();
  const telemetryMapName =
    isHost && isConnected && state?.map ? state.map : null;
  const fallbackUrl = useMemo(
    () =>
      getLobbyBgImage({
        customImageUrl: imageUrl ?? null,
        telemetryMapName,
        fallbackMapName,
      }),
    [imageUrl, telemetryMapName, fallbackMapName]
  );

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const hasRealImage = Boolean(imageUrl) && !failed;
  const resolvedUrl = hasRealImage ? imageUrl : fallbackUrl;
  const hasImage = Boolean(resolvedUrl);

  return (
    <>
      <div className="absolute inset-0 z-0 bg-sand" />
      {hasImage && (
        <FadeInImage
          src={resolvedUrl ?? ""}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 z-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {/* Overlay layers (global tint + side shading + bottom shading). */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[#070c12]/35" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(7,12,18,0.95)_0%,rgba(7,12,18,0.80)_35%,rgba(7,12,18,0.80)_65%,rgba(7,12,18,0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(0deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_30%,rgba(0,0,0,0.00)_55%)]" />
    </>
  );
}
