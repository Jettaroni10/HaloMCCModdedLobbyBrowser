"use client";

import RosterFriendButton from "./RosterFriendButton";

type LobbyRosterMember = {
  slotNumber: number;
  displayName: string;
  srLevel: number;
  userId: string;
};

type LobbyRosterProps = {
  roster: LobbyRosterMember[];
  viewerUserId?: string | null;
  friendIds?: string[];
  pendingIds?: string[];
};

export default function LobbyRoster({
  roster,
  viewerUserId,
  friendIds = [],
  pendingIds = [],
}: LobbyRosterProps) {
  const friendSet = new Set(friendIds);
  const pendingSet = new Set(pendingIds);

  return (
    <section className="rounded-md border border-ink/10 bg-sand p-6">
      <h2 className="text-lg font-semibold text-ink">Roster</h2>
      {roster.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">No members yet.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {roster.map((member) => (
            <div
              key={`${member.slotNumber}-${member.userId}`}
              className="flex items-center justify-between rounded-sm border border-ink/10 bg-mist px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-ink text-[11px] font-semibold text-sand">
                  {member.slotNumber}
                </div>
                <span className="text-sm font-semibold text-ink">
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
                <div className="rounded-sm border border-ink/20 px-2 py-1 text-[10px] font-semibold text-ink">
                  SR{member.srLevel}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
