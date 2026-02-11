"use client";

import { useEffect, useState } from "react";
import { useHostNotifications } from "@/components/HostNotificationsProvider";
import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";
import { useNotificationsDrawer } from "./NotificationsDrawerContext";

type NotificationsBellButtonProps = {
  userId?: string | null;
};

export default function NotificationsBellButton({
  userId,
}: NotificationsBellButtonProps) {
  const { unreadCount } = useHostNotifications();
  const { toggle } = useNotificationsDrawer();
  const [isOverlayEnv, setIsOverlayEnv] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bridge = (window as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

  if (!userId || !isOverlayEnv) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-sm transition ${OverlayThemeClasses.buttonGhost} ${OverlayThemeClasses.focusRing} no-drag`}
      aria-label="Toggle notifications drawer"
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-4 w-4 text-ink/80"
      >
        <path
          fill="currentColor"
          d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 0 0-4.5-5.82V4a1.5 1.5 0 0 0-3 0v1.18A6 6 0 0 0 6 11v5l-1.6 1.6a.75.75 0 0 0 .53 1.27h14.14a.75.75 0 0 0 .53-1.27L18 16Z"
        />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 rounded-full bg-clay px-1.5 py-0.5 text-[9px] font-semibold text-ink shadow">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
