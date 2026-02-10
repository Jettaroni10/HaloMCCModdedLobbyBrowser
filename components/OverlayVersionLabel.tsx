"use client";

import { useEffect, useState } from "react";

type OverlayBridge = {
  getAppVersion?: () => Promise<string>;
};

export default function OverlayVersionLabel() {
  const [version, setVersion] = useState<string>("");

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: OverlayBridge })
      .hmccOverlay;
    if (!bridge || typeof bridge.getAppVersion !== "function") return;

    let active = true;
    bridge
      .getAppVersion()
      .then((value) => {
        if (!active) return;
        if (typeof value === "string" && value.trim().length > 0) {
          setVersion(value.trim());
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  if (!version) return null;

  return (
    <div className="pointer-events-none fixed bottom-2 right-3 z-50 rounded-sm border border-ink/20 bg-sand/70 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-ink/65">
      HMCC Overlay v{version}
    </div>
  );
}

