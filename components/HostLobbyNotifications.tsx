"use client";

import { useHostNotifications } from "./HostNotificationsProvider";

type HostLobbyNotificationsProps = {
  enabled: boolean;
  hostUserId?: string | null;
};

export default function HostLobbyNotifications({
  enabled,
  hostUserId,
}: HostLobbyNotificationsProps) {
  const { unreadCount, markViewed } = useHostNotifications();

  if (!enabled || !hostUserId) {
    return null;
  }

  return (
    <>
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
          </div>
        </div>
      </div>
    </>
  );
}
