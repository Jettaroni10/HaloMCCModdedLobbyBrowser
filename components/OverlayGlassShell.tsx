"use client";

import { useEffect, useState } from "react";

export default function OverlayGlassShell() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    const enabled = Boolean(bridge);
    setActive(enabled);
    if (enabled) {
      document.body.classList.add("hmcc-overlay");
      document.body.classList.add("overlay-env");
    }
    return () => {
      document.body.classList.remove("hmcc-overlay");
      document.body.classList.remove("overlay-env");
    };
  }, []);

  if (!active) return null;

  return <div className="hmcc-overlay-glass" aria-hidden="true" />;
}
