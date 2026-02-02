"use client";

import { useHostNotifications } from "./HostNotificationsProvider";

type HostNotificationToggleProps = {
  userId?: string | null;
};

export default function HostNotificationToggle({
  userId,
}: HostNotificationToggleProps) {
  const { muted, setMuted, soundBlocked, enableSound } =
    useHostNotifications();

  if (!userId) return null;

  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-ink/70">
      {soundBlocked && !muted && (
        <button
          type="button"
          onClick={enableSound}
          className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70"
        >
          🔔 Enable sounds
        </button>
      )}
      <button
        type="button"
        onClick={() => setMuted(!muted)}
        className="inline-flex items-center gap-2 rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink/70"
        aria-pressed={muted}
        title="Mute notification pings"
      >
        <span aria-hidden>{muted ? "🔇" : "🔊"}</span>
        <span>{muted ? "Muted" : "Pings"}</span>
      </button>
    </div>
  );
}
