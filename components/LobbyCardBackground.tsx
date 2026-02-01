"use client";

import { useEffect, useState } from "react";

type LobbyCardBackgroundProps = {
  lobbyId: string;
  hasImage: boolean;
  fallbackUrl?: string;
};

export default function LobbyCardBackground({
  lobbyId,
  hasImage,
  fallbackUrl = "/images/map-placeholder.webp",
}: LobbyCardBackgroundProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch(`/api/lobbies/${lobbyId}/map-image-public`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (active) setUrl(null);
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { url?: string | null }
        | null;
      if (active) setUrl(payload?.url ?? null);
    }
    if (hasImage) {
      void load();
    } else {
      setUrl(null);
    }
    return () => {
      active = false;
    };
  }, [lobbyId, hasImage]);

  const hasRealImage = Boolean(url);
  const src = url ?? fallbackUrl;

  return (
    <>
      {hasRealImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-[#081826]/35" />
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
    </>
  );
}
