import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import SpartanPortrait from "@/components/SpartanPortrait";
import UserProfileActions from "@/components/UserProfileActions";
import { HALO_GAMES } from "@/data/haloGames";
import { HALO_WEAPONS } from "@/data/haloWeapons";
import { clampRank } from "@/lib/ranks";
import { getSignedUserReadUrl } from "@/lib/user-images";
import ProfileViewTracker from "@/components/analytics/ProfileViewTracker";

export default async function UserProfilePage({
  params,
}: {
  params: { gamertag: string };
}) {
  const rawGamertag = decodeURIComponent(params.gamertag ?? "").trim();
  if (!rawGamertag) {
    notFound();
  }

  const user = await prisma.user.findFirst({
    where: { gamertag: { equals: rawGamertag, mode: "insensitive" } },
    select: {
      id: true,
      gamertag: true,
      nametagColor: true,
      srLevel: true,
      xpThisLevel: true,
      reputationScore: true,
      favoriteGameId: true,
      favoriteWeaponId: true,
      spartanImagePath: true,
    },
  });

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-12 text-sm text-ink/70">
        User not found.
      </div>
    );
  }

  const viewer = await getCurrentUser();
  const isSelf = Boolean(viewer && viewer.id === user.id);

  const spartanImageUrl = user.spartanImagePath
    ? await getSignedUserReadUrl(user.spartanImagePath)
    : null;
  const favoriteGameName =
    HALO_GAMES.find((game) => game.id === user.favoriteGameId)?.name ??
    "Not set";
  const favoriteWeaponName =
    HALO_WEAPONS.find((weapon) => weapon.id === user.favoriteWeaponId)?.name ??
    "Not set";
  const rankLabel = `sr${clampRank(user.srLevel ?? 1)}`;

  const [friendCount, hostedCount, messageCount] = await Promise.all([
    prisma.friendship.count({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    }),
    prisma.lobby.count({ where: { hostUserId: user.id } }),
    prisma.message.count({ where: { senderUserId: user.id } }),
  ]);

  let isFriend = false;
  let isPending = false;
  let isBlocked = false;
  let blockedByTarget = false;
  let canInvite = false;
  let canMessage = false;

  if (viewer && !isSelf) {
    const [userAId, userBId] = viewer.id < user.id ? [viewer.id, user.id] : [user.id, viewer.id];
    const [friendship, pending, blocked] = await Promise.all([
      prisma.friendship.findUnique({
        where: { userAId_userBId: { userAId, userBId } },
        select: { id: true },
      }),
      prisma.friendRequest.findFirst({
        where: {
          OR: [
            { fromUserId: viewer.id, toUserId: user.id, status: "PENDING" },
            { fromUserId: user.id, toUserId: viewer.id, status: "PENDING" },
          ],
        },
        select: { id: true, fromUserId: true, toUserId: true },
      }),
      prisma.block.findFirst({
        where: {
          OR: [
            { blockerUserId: viewer.id, blockedUserId: user.id },
            { blockerUserId: user.id, blockedUserId: viewer.id },
          ],
        },
        select: { blockerUserId: true },
      }),
    ]);

    isFriend = Boolean(friendship);
    isPending = Boolean(pending);
    isBlocked = Boolean(blocked && blocked.blockerUserId === viewer.id);
    blockedByTarget = Boolean(blocked && blocked.blockerUserId === user.id);

    canMessage = isFriend && !blockedByTarget;
    if (canMessage) {
      const activeLobby = await prisma.lobby.findFirst({
        where: {
          hostUserId: viewer.id,
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });
      canInvite = Boolean(activeLobby);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <ProfileViewTracker section="identity" />
      <header>
        <h1 className="text-3xl font-semibold text-ink">Profile</h1>
        <p className="mt-2 text-sm text-ink/70">
          Player identity and stats.
        </p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <div className="rounded-md border border-ink/10 bg-sand/80 p-4 backdrop-blur">
            <SpartanPortrait imageUrl={spartanImageUrl} />
          </div>
          <div className="rounded-md border border-ink/10 bg-sand/80 p-4 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
              Identity facts
            </p>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink/70">Favorite game</span>
                <span className="font-semibold text-ink">{favoriteGameName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink/70">Favorite weapon</span>
                <span className="font-semibold text-ink">
                  {favoriteWeaponName}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-md border border-ink/10 bg-sand/80 p-6 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.35em] text-ink/50">
              Identity
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-3xl font-semibold text-ink">
                  {user.gamertag}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <SocialRankBadge rank={user.srLevel ?? 1} size={56} showLabel={false} />
                  <span className="rounded-sm bg-ink/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/80">
                    {rankLabel}
                  </span>
                </div>
              </div>
              <div className="min-w-[220px] flex-1">
                <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                  Progress
                </p>
                <p className="mt-2 text-xs text-ink/60">
                  {user.xpThisLevel ?? 0} XP earned toward next SR
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink/60">
              <span className="rounded-sm border border-ink/15 bg-mist px-2 py-1">
                Favorite game: {favoriteGameName}
              </span>
              <span className="rounded-sm border border-ink/15 bg-mist px-2 py-1">
                Favorite weapon: {favoriteWeaponName}
              </span>
            </div>
          </div>

          {!isSelf && viewer && (
            <UserProfileActions
              targetGamertag={user.gamertag}
              targetUserId={user.id}
              isFriend={isFriend}
              isPending={isPending}
              isBlocked={isBlocked}
              blockedByTarget={blockedByTarget}
              canInvite={canInvite}
              canMessage={canMessage}
            />
          )}
          {isSelf && (
            <div className="rounded-sm border border-ink/15 bg-mist px-3 py-2 text-xs text-ink/60">
              You are viewing your profile. Edit details in profile settings.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-ink/10 bg-sand/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Friends
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {friendCount}
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-sand/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Hosted lobbies
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {hostedCount}
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-sand/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Messages sent
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {messageCount}
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-sand/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Reputation
              </p>
              <p className="mt-2 text-2xl font-semibold text-ink">
                {user.reputationScore ?? 0}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
