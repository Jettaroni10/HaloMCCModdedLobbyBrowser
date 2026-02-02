import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { xpRequired } from "@/lib/xp";
import {
  ReachColors,
  nameplateTextColor,
  resolveNametagColor,
} from "@/lib/reach-colors";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { clampRank } from "@/lib/ranks";
import { HALO_GAMES } from "@/data/haloGames";
import { HALO_WEAPONS } from "@/data/haloWeapons";
import SpartanImageUploader from "@/components/SpartanImageUploader";
import FavoriteWeaponSelect from "@/components/FavoriteWeaponSelect";
import { getSignedUserReadUrl } from "@/lib/user-images";

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
  const selectedColor = resolveNametagColor(
    profile?.nametagColor ?? user.nametagColor
  );
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
  const [friendCount, hostedCount, messageCount] = await Promise.all([
    prisma.friendship.count({
      where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    }),
    prisma.lobby.count({ where: { hostUserId: user.id } }),
    prisma.message.count({ where: { senderUserId: user.id } }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header>
        <h1 className="text-3xl font-semibold text-ink">Profile settings</h1>
        <p className="mt-2 text-sm text-ink/70">
          Keep your profile light. Hosts can share extra details in each lobby.
        </p>
      </header>

      <section className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <SpartanImageUploader initialUrl={spartanImageUrl} />

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
                  {profile?.gamertag ?? user.gamertag ?? "Set your gamertag"}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <SocialRankBadge rank={srLevel} size={56} showLabel={false} />
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

          <div className="flex flex-wrap gap-2">
            <a
              href="/friends"
              className="rounded-sm border border-ink/20 bg-mist px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
            >
              Open friends
            </a>
            <a
              href="/host"
              className="rounded-sm border border-ink/20 bg-mist px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
            >
              Host dashboard
            </a>
            <a
              href="/browse"
              className="rounded-sm border border-ink/20 bg-mist px-3 py-1 text-xs font-semibold text-ink hover:border-ink/40"
            >
              Browse lobbies
            </a>
          </div>

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

      <form
        action="/api/profile"
        method="post"
        className="mt-8 space-y-5 rounded-md border border-ink/10 bg-sand p-6"
      >
        {needsGamertag && (
          <div className="rounded-sm border border-clay/40 bg-mist px-4 py-3 text-sm text-clay">
            Gamertag required. Please set your gamertag to continue.
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Gamertag
          <input
            name="gamertag"
            defaultValue={profile?.gamertag ?? user.gamertag ?? ""}
            placeholder="Your gamertag"
            required
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email
          <input
            name="email"
            type="email"
            defaultValue={profile?.email ?? user.email ?? ""}
            required
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Favorite game
          <select
            name="favoriteGameId"
            defaultValue={profile?.favoriteGameId ?? ""}
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          >
            <option value="">Not set</option>
            {HALO_GAMES.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-ink">
          Favorite weapon
          <div className="mt-2">
            <FavoriteWeaponSelect
              name="favoriteWeaponId"
              defaultValue={profile?.favoriteWeaponId ?? ""}
            />
          </div>
        </label>

        <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
            Nameplate preview
          </p>
          <div className="mt-3 inline-flex items-center gap-3">
            <span
              className="rounded-sm px-3 py-1 text-sm font-semibold"
              style={{
                backgroundColor: selectedColor,
                color: nameplateTextColor(selectedColor),
              }}
            >
              {profile?.gamertag ?? user.gamertag}
            </span>
            <span className="text-[10px] text-ink/60">
              Current nametag color
            </span>
          </div>
        </div>

        <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3">
          <p className="text-sm font-semibold text-ink">Nametag color</p>
          <p className="mt-1 text-xs text-ink/60">
            Choose a classic multiplayer color for your name.
          </p>
          <details className="mt-4 rounded-sm border border-ink/10 bg-sand px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">
              Change color
            </summary>
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {ReachColors.map((color) => (
                <label
                  key={color.name}
                  className="flex flex-col items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-ink/60"
                  title={color.name}
                >
                  <input
                    type="radio"
                    name="nametagColor"
                    value={color.hex}
                    defaultChecked={selectedColor === color.hex}
                    className="peer sr-only"
                  />
                  <span
                    className="h-10 w-10 rounded-sm border border-ink/20 shadow-sm peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-checked:ring-offset-sand"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-[9px] text-ink/70">{color.name}</span>
                </label>
              ))}
            </div>
          </details>
        </div>

        <button
          type="submit"
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}

