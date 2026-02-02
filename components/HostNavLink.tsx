"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type HostNavLinkProps = {
  hostUserId?: string | null;
};

const UNREAD_KEY = "customs:hostUnreadCount";

function parseUnread(value: string | null) {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export default function HostNavLink({ hostUserId }: HostNavLinkProps) {
  const [count, setCount] = useState(0);
  const unreadKey = hostUserId ? `${UNREAD_KEY}:${hostUserId}` : UNREAD_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCount(parseUnread(window.localStorage.getItem(unreadKey)));
  }, [unreadKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === unreadKey) {
        setCount(parseUnread(event.newValue));
      }
    };
    const handleCustom = (event: Event) => {
      const detail = (event as CustomEvent).detail as { count?: number } | null;
      if (typeof detail?.count === "number") {
        setCount(detail.count);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("customs:hostUnread", handleCustom);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("customs:hostUnread", handleCustom);
    };
  }, []);

  return (
    <Link
      href="/host"
      className="relative inline-flex items-center gap-2 hover:text-ink/80"
    >
      <span>Host</span>
      {hostUserId && count > 0 && (
        <span className="rounded-sm border border-ink/20 bg-clay/20 px-2 py-0.5 text-[10px] font-semibold text-ink">
          {count}
        </span>
      )}
    </Link>
  );
}
