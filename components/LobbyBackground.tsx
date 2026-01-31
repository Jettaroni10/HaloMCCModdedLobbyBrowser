"use client";

import { useEffect, useState } from "react";

type LobbyBackgroundProps = {
  lobbyId: string;
  fallbackUrl?: string;
};

export default function LobbyBackground({
  lobbyId,
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

  return (
    <>
      <img
        src={src}
        alt="Lobby map background"
        className="fixed inset-0 -z-20 h-full w-full object-cover"
      />
      <div className="fixed inset-0 -z-10 bg-black/40" />
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(0,0,0,0.15), rgba(0,0,0,0.75) 70%)",
        }}
      />
    </>
  );
}
