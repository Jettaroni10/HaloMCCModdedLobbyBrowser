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
      <div
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url("${src}")` }}
      />
      <div
        className={`absolute inset-0 -z-10 ${
          hasRealImage ? "bg-black/20" : "bg-[#081826]/35"
        }`}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: hasRealImage
            ? "radial-gradient(circle at 50% 20%, rgba(0,0,0,0.05), rgba(0,0,0,0.35) 70%)"
            : "radial-gradient(circle at 50% 20%, rgba(0,0,0,0.2), rgba(0,0,0,0.6) 70%)",
        }}
      />
    </>
  );
}
