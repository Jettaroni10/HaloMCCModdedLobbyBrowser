"use client";

import { useEffect, useState } from "react";
import MapPreview from "./MapPreview";

type LobbyMapImageProps = {
  lobbyId: string;
  hasImage: boolean;
};

export default function LobbyMapImage({ lobbyId, hasImage }: LobbyMapImageProps) {
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

  return (
    <section className="rounded-md border border-ink/10 bg-sand p-6">
      <MapPreview imageUrl={url} />
      <p className="mt-3 text-xs text-ink/60">
        {hasImage
          ? "Map image uploaded by host"
          : "Map image preview not provided."}
      </p>
    </section>
  );
}
