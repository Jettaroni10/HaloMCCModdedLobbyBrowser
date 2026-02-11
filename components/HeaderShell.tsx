"use client";

import { useEffect, useState } from "react";
import type { SessionUser } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import OverlayHeader from "@/components/OverlayHeader";

type HeaderShellProps = {
  user: SessionUser | null;
  isAdmin: boolean;
};

export default function HeaderShell({ user, isAdmin }: HeaderShellProps) {
  const [isOverlayEnv, setIsOverlayEnv] = useState(() => {
    if (typeof window === "undefined") return false;
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    return Boolean(bridge);
  });

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

  if (isOverlayEnv) {
    return <OverlayHeader user={user} isAdmin={isAdmin} />;
  }

  return <SiteHeader user={user} isAdmin={isAdmin} />;
}
