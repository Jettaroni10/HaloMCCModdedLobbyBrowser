"use client";

import { useEffect, useState } from "react";

type LobbyBackgroundProps = {
  lobbyId: string;
  hasRealImage: boolean;
  fallbackUrl?: string;
};

export default function LobbyBackground({
  lobbyId,
  hasRealImage,
  fallbackUrl = "/images/map-placeholder.webp",
}: LobbyBackgroundProps) {
  const [url, setUrl] = useState<string | null>(null);

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

  const src = url ?? fallbackUrl;
  const baseTint = hasRealImage ? "bg-black/5" : "bg-[#081826]/35";
  const vignette = hasRealImage
    ? "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.02), rgba(0,0,0,0.25) 70%)"
    : "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.2), rgba(0,0,0,0.6) 70%)";

  return (
    <>
      <img
        src={src}
        alt="Lobby map background"
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      />
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
