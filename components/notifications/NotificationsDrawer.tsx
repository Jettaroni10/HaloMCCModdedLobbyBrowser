"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";
import { useHostNotifications } from "@/components/HostNotificationsProvider";
import { useNotificationsDrawer } from "./NotificationsDrawerContext";

function formatAge(iso: string) {
  const created = new Date(iso).getTime();
  if (!Number.isFinite(created)) return "Just now";
  const diffMs = Math.max(0, Date.now() - created);
  const diffSec = Math.round(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function NotificationsDrawer() {
  const [mounted, setMounted] = useState(false);
  const [isOverlayEnv, setIsOverlayEnv] = useState(false);
  const [peek, setPeek] = useState(false);
  const { isOpen, close } = useNotificationsDrawer();
  const {
    notifications,
    unreadCount,
    markViewed,
    clearAll,
    dismissNotification,
  } = useHostNotifications();
  const prevUnread = useRef(unreadCount);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const bridge = (window as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (unreadCount > prevUnread.current) {
        setPeek(true);
        const timer = setTimeout(() => setPeek(false), 800);
        return () => clearTimeout(timer);
      }
    }
    prevUnread.current = unreadCount;
  }, [unreadCount, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    markViewed();
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, close, markViewed]);

  const panelTransform = useMemo(() => {
    if (isOpen) return "translateX(0)";
    if (peek) return "translateX(calc(100% - 24px))";
    return "translateX(100%)";
  }, [isOpen, peek]);

  if (!mounted || !isOverlayEnv) return null;

  const content = (
    <>
      {isOpen && (
        <div
          className="no-drag fixed inset-0 z-[9998] bg-black/30"
          onClick={close}
        />
      )}
      <aside
        id="hmcc-notifications-drawer"
        className={`no-drag fixed right-0 top-0 z-[9999] flex h-full w-[360px] max-w-[80vw] flex-col border-l bg-sand text-ink shadow-2xl transition-transform duration-200 ease-out md:w-[400px] ${OverlayThemeClasses.border}`}
        style={{ transform: panelTransform }}
        aria-hidden={!isOpen}
      >
        <div className="flex items-center justify-between border-b border-ink/15 px-5 py-4">
          <div>
            <p className={`text-xs uppercase tracking-[0.3em] ${OverlayThemeClasses.mutedText}`}>
              Alerts
            </p>
            <p className={`text-lg font-semibold ${OverlayThemeClasses.text}`}>
              Notifications
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-sm transition ${OverlayThemeClasses.buttonGhost} ${OverlayThemeClasses.focusRing}`}
            aria-label="Close notifications"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {notifications.length === 0 ? (
            <div
              className={`rounded-sm border border-ink/15 bg-mist/60 px-4 py-5 text-sm ${OverlayThemeClasses.mutedText}`}
            >
              No notifications yet.
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-sm border px-4 py-3 text-sm shadow-sm ${
                    item.read
                      ? "border-ink/10 bg-mist/40 text-ink/70"
                      : "border-ink/25 bg-mist/70 text-ink"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {!item.read && (
                        <span className="h-2 w-2 rounded-full bg-clay" />
                      )}
                      <span className="font-semibold">{item.message}</span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.2em] text-ink/60">
                      {formatAge(item.createdAt)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.2em]">
                    <button
                      type="button"
                      onClick={() => dismissNotification(item.id)}
                      className={`rounded-sm border px-2 py-1 ${OverlayThemeClasses.buttonGhost}`}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-ink/15 px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.25em]">
          <button
            type="button"
            onClick={markViewed}
            className={`rounded-sm px-3 py-2 ${OverlayThemeClasses.buttonGhost}`}
          >
            Mark all as read
          </button>
          <button
            type="button"
            onClick={clearAll}
            className={`rounded-sm px-3 py-2 ${OverlayThemeClasses.buttonDanger}`}
          >
            Clear all
          </button>
        </div>
      </aside>
    </>
  );

  return createPortal(content, document.body);
}
