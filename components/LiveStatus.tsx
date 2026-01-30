"use client";

import { useEffect, useState } from "react";

export default function LiveStatus() {
  const [status, setStatus] = useState<"connecting" | "live" | "offline">(
    "connecting"
  );

  useEffect(() => {
    const source = new EventSource("/api/lobbies/stream");

    source.addEventListener("ready", () => setStatus("live"));
    source.addEventListener("error", () => setStatus("offline"));

    return () => {
      source.close();
    };
  }, []);

  const label =
    status === "live"
      ? "Live updates connected"
      : status === "offline"
      ? "Live updates offline"
      : "Connecting live updates…";

  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/60">
      <span
        className={`h-2 w-2 rounded-full ${
          status === "live"
            ? "bg-moss"
            : status === "offline"
            ? "bg-clay"
            : "bg-ink/30"
        }`}
      />
      {label}
    </div>
  );
}
