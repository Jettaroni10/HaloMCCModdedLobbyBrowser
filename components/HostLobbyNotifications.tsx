"use client";

import { useHostEvents } from "./useHostEvents";

type HostLobbyNotificationsProps = {
  enabled: boolean;
  hostUserId?: string | null;
};

export default function HostLobbyNotifications({
  enabled,
  hostUserId,
}: HostLobbyNotificationsProps) {
  const {
    toasts,
    dismissToast,
    unreadCount,
    markViewed,
    muted,
    setMuted,
    soundBlocked,
    enableSound,
  } = useHostEvents({ enabled, hostUserId });

  if (!enabled) {
    return null;
  }

  return (
    <>
      {toasts.length > 0 && (
        <div className="fixed right-6 top-6 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-sm border border-ink/20 bg-mist/90 px-4 py-2 text-sm text-ink shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  className="text-xs font-semibold text-ink/60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-sm border border-ink/15 bg-mist/90 px-4 py-3 text-xs text-ink/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">Host alerts</span>
            {unreadCount > 0 && (
              <span className="rounded-sm bg-clay/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={markViewed}
              className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70"
            >
              Mark viewed
            </button>
            <label className="flex items-center gap-2 text-[10px] font-semibold text-ink/60">
              <input
                type="checkbox"
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink/20"
              />
              Mute pings
            </label>
          </div>
        </div>
        {soundBlocked && !muted && (
          <button
            type="button"
            onClick={enableSound}
            className="mt-2 inline-flex items-center gap-2 rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70"
          >
            🔔 Click to enable notification sounds
          </button>
        )}
      </div>
    </>
  );
}
