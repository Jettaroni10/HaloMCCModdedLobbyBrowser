"use client";

import Link from "next/link";
import { hashId, trackEvent } from "@/lib/analytics";

type TrackedLobbyLinkProps = {
  href: string;
  lobbyId: string;
  game: string;
  isModded: boolean;
  modCount: number;
  position: number;
  className?: string;
  children: React.ReactNode;
};

export default function TrackedLobbyLink({
  href,
  lobbyId,
  game,
  isModded,
  modCount,
  position,
  className,
  children,
}: TrackedLobbyLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() =>
        trackEvent("browse_result_clicked", {
          lobby_id: hashId(lobbyId),
          game,
          is_modded: isModded,
          mod_count: modCount,
          position_in_list: position,
        })
      }
    >
      {children}
    </Link>
  );
}
