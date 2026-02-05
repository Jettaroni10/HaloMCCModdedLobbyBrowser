import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { xpRequired } from "@/lib/xp";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { clampRank } from "@/lib/ranks";
import { HALO_GAMES } from "@/data/haloGames";
import { HALO_WEAPONS } from "@/data/haloWeapons";
import SpartanImageUploader from "@/components/SpartanImageUploader";
import { getSignedUserReadUrl } from "@/lib/user-images";
import ProfileSettingsForm from "@/components/profile/ProfileSettingsForm";

type ProfilePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const user = await requireAuth({ requireGamertag: false });
  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      gamertag: true,
      email: true,
      nametagColor: true,
      srLevel: true,
      xpThisLevel: true,
      xpTotal: true,
      reputationScore: true,
      favoriteGameId: true,
      favoriteWeaponId: true,
      spartanImagePath: true,
    },
  });
  const srLevel = profile?.srLevel ?? user.srLevel ?? 1;
  const xpThisLevel = profile?.xpThisLevel ?? user.xpThisLevel ?? 0;
  const xpNeeded = xpRequired(srLevel);
  const xpToNext = Math.max(0, xpNeeded - xpThisLevel);
  const progressPercent =
    xpNeeded > 0 ? Math.min(100, Math.round((xpThisLevel / xpNeeded) * 100)) : 0;
  const needsGamertag = Boolean(searchParams?.needsGamertag);
  const rankLabel = `sr${clampRank(srLevel)}`;
  const favoriteGameName =
    HALO_GAMES.find((game) => game.id === profile?.favoriteGameId)?.name ??
    "Not set";
  const favoriteWeaponName =
    HALO_WEAPONS.find((weapon) => weapon.id === profile?.favoriteWeaponId)
      ?.name ?? "Not set";
  const spartanImageUrl = profile?.spartanImagePath
    ? await getSignedUserReadUrl(profile.spartanImagePath)
    : null;
  const initialGamertag = profile?.gamertag ?? user.gamertag ?? "";
  const initialEmail = profile?.email ?? user.email ?? "";
  const initialFavoriteGameId = profile?.favoriteGameId ?? "";
  const initialFavoriteWeaponId = profile?.favoriteWeaponId ?? "";
  const initialNametagColor = profile?.nametagColor ?? user.nametagColor ?? "";
  const [friendCount, hostedCount, messageCount] = await Promise.all([
    prisma.friendship.count({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    }),
    prisma.lobby.count({ where: { hostUserId: user.id } }),
    prisma.message.count({ where: { senderUserId: user.id } }),
  ]);

  return (
    <div className="w-full">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header>
          <h1 className="text-3xl font-semibold text-ink">
            Profile settings
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Keep your profile light. Hosts can share extra details in each lobby.
          </p>
        </header>

        <section className="mt-8 grid gap-6 lg:grid lg:grid-cols-[360px_1fr] lg:gap-6">
          <div className="lg:self-start">
            <div className="w-full lg:sticky lg:top-24">
              <SpartanImageUploader initialUrl={spartanImageUrl} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-md border border-ink/10 bg-sand/80 p-4 backdrop-blur sm:p-5">
                <p className="text-xs uppercase tracking-[0.35em] text-ink/50">
                  Identity
                </p>
                <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-3xl font-semibold text-ink">
                      {profile?.gamertag ?? user.gamertag ?? "Set your gamertag"}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <SocialRankBadge
                        rank={srLevel}
                        size={56}
                        showLabel={false}
                      />
                      <span className="rounded-sm bg-ink/15 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-ink/80">
                        {rankLabel}
                      </span>
                    </div>
                  </div>
                  <div className="w-full max-w-md">
                    <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                      Progress
                    </p>
                    <p className="mt-2 text-xs text-ink/60">
                      {xpThisLevel}/{xpNeeded} XP · {xpToNext} to next SR
                    </p>
                    <div className="mt-3 h-2 w-full rounded-sm bg-mist">
                      <div
                        className="h-2 rounded-sm bg-ink"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
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

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a
                  href="/friends"
                  className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 bg-mist px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/50"
                >
                  Open friends
                </a>
                <a
                  href="/host"
                  className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 bg-mist px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/50"
                >
                  Host dashboard
                </a>
                <a
                  href="/browse"
                  className="inline-flex h-11 items-center justify-center rounded-sm border border-ink/20 bg-mist px-4 text-sm font-semibold text-ink hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink/50"
                >
                  Browse lobbies
                </a>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-md border border-ink/10 bg-sand/80 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                    Friends
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {friendCount}
                  </p>
                </div>
                <div className="rounded-md border border-ink/10 bg-sand/80 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                    Hosted lobbies
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {hostedCount}
                  </p>
                </div>
                <div className="rounded-md border border-ink/10 bg-sand/80 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                    Messages sent
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {messageCount}
                  </p>
                </div>
                <div className="rounded-md border border-ink/10 bg-sand/80 p-4 sm:p-5">
                  <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                    Reputation
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-ink">
                    {user.reputationScore ?? 0}
                  </p>
                </div>
              </div>
            </div>

            <ProfileSettingsForm
              needsGamertag={needsGamertag}
              initialGamertag={initialGamertag}
              initialEmail={initialEmail}
              initialFavoriteGameId={initialFavoriteGameId}
              initialFavoriteWeaponId={initialFavoriteWeaponId}
              initialNametagColor={initialNametagColor}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

