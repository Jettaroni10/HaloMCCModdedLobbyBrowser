"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const OVERLAY_REFRESH_MS = 8000;
const OVERLAY_PATHS = ["/browse", "/host", "/lobbies"];

export default function OverlayAutoRefresher() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    if (!bridge) return;

    const shouldRefresh = OVERLAY_PATHS.some((path) =>
      pathname.startsWith(path)
    );
    if (!shouldRefresh) return;

    router.refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    const timer = setInterval(() => router.refresh(), OVERLAY_REFRESH_MS);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pathname, router]);

  return null;
}
