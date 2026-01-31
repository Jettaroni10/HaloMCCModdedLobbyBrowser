"use client";

import RosterFriendButton from "./RosterFriendButton";
import { nameplateTextColor, resolveNametagColor } from "@/lib/reach-colors";

type LobbyRosterMember = {
  slotNumber: number;
  displayName: string;
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
                className="flex h-10 items-center justify-between rounded-sm border border-white/10 px-3"
                style={{
                  backgroundColor: "rgba(0,0,0,0.35)",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/70 text-[11px] font-semibold text-white">
                    {slotNumber}
                  </div>
                  <span className="text-sm font-semibold">Empty</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`slot-${slotNumber}`}
              className="flex h-10 items-center justify-between rounded-sm border border-white/10 px-3"
              style={{
                backgroundColor: resolveNametagColor(member.nametagColor),
                color: nameplateTextColor(member.nametagColor),
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-black/70 text-[11px] font-semibold text-white">
                  {slotNumber}
                </div>
                <span className="text-sm font-semibold">
                  {member.displayName}
                </span>
              </div>
              <div className="flex items-center gap-3">
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
                <div className="rounded-sm border border-white/20 bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
                  SR{member.srLevel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
