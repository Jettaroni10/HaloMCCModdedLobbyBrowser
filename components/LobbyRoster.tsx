"use client";

import RosterFriendButton from "./RosterFriendButton";
import Nametag from "@/components/user/Nametag";

type LobbyRosterMember = {
  slotNumber: number;
  gamertag: string;
  srLevel: number;
  userId: string;
  nametagColor?: string | null;
};

type LobbyRosterProps = {
  roster: LobbyRosterMember[];
  viewerUserId?: string | null;
  friendIds?: string[];
  pendingIds?: string[];
  className?: string;
  slotsTotal?: number;
};

export default function LobbyRoster({
  roster,
  viewerUserId,
  friendIds = [],
  pendingIds = [],
  className,
  slotsTotal = 16,
}: LobbyRosterProps) {
  const friendSet = new Set(friendIds);
  const pendingSet = new Set(pendingIds);
  const rowHeight = 40;
  const rowGap = 8;
  const headerAndPadding = 80;
  const totalHeight =
    slotsTotal * rowHeight +
    Math.max(0, slotsTotal - 1) * rowGap +
    headerAndPadding;
  const memberBySlot = new Map(
    roster.map((member) => [member.slotNumber, member])
  );
  const slots = Array.from({ length: slotsTotal }, (_, index) => index + 1);

  return (
    <section
      className={`rounded-md border border-white/10 bg-black/40 p-6 backdrop-blur-sm ${
        className ?? ""
      }`}
      style={{ height: totalHeight }}
    >
      <h2 className="text-xs font-semibold uppercase tracking-[0.4em] text-white/80">
        Roster
      </h2>
      <div className="mt-4 space-y-2">
        {slots.map((slotNumber) => {
          const member = memberBySlot.get(slotNumber);
          if (!member) {
            return (
              <div
                key={`slot-${slotNumber}`}
                className="flex h-10 items-center gap-3"
              >
                <div className="w-8 text-center text-xs font-semibold text-white/45 tabular-nums">
                  #{slotNumber}
                </div>
                <div className="flex h-10 min-w-0 flex-1 items-center rounded-sm border border-white/10 px-3 text-sm font-semibold text-white/45">
                  Empty
                </div>
              </div>
            );
          }

          return (
            <div
              key={`slot-${slotNumber}`}
              className="flex h-10 items-center gap-3"
            >
              <div className="w-8 text-center text-xs font-semibold text-white/70 tabular-nums">
                #{slotNumber}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Nametag
                  gamertag={member.gamertag}
                  rank={member.srLevel}
                  nametagColor={member.nametagColor}
                  className="h-10 flex-1"
                />
                {viewerUserId && member.userId !== viewerUserId && (
                  <RosterFriendButton
                    targetUserId={member.userId}
                    initialState={
                      friendSet.has(member.userId)
                        ? "friends"
                        : pendingSet.has(member.userId)
                        ? "pending"
                        : "available"
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
