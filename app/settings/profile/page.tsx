import { requireAuth } from "@/lib/auth";
import { xpRequired } from "@/lib/xp";
import {
  ReachColors,
  nameplateTextColor,
  resolveNametagColor,
} from "@/lib/reach-colors";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { clampRank } from "@/lib/ranks";

type ProfilePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const user = await requireAuth({ requireGamertag: false });
  const srLevel = user.srLevel ?? 1;
  const xpThisLevel = user.xpThisLevel ?? 0;
  const xpNeeded = xpRequired(srLevel);
  const xpToNext = Math.max(0, xpNeeded - xpThisLevel);
  const progressPercent =
    xpNeeded > 0 ? Math.min(100, Math.round((xpThisLevel / xpNeeded) * 100)) : 0;
  const selectedColor = resolveNametagColor(user.nametagColor);
  const needsGamertag = Boolean(searchParams?.needsGamertag);
  const rankLabel = `sr${clampRank(srLevel)}`;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Profile settings</h1>
      <p className="mt-2 text-sm text-ink/70">
        Keep your profile light. Hosts can share extra details in each lobby.
      </p>

      <form
        action="/api/profile"
        method="post"
        className="mt-6 space-y-5 rounded-md border border-ink/10 bg-sand p-6"
      >
        {needsGamertag && (
          <div className="rounded-sm border border-clay/40 bg-mist px-4 py-3 text-sm text-clay">
            Gamertag required. Please set your gamertag to continue.
          </div>
        )}
        <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Social rank
              </p>
              <div className="mt-2 flex items-center gap-4">
                <SocialRankBadge rank={srLevel} size={48} showLabel={false} />
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold text-ink">
                    Social Rank
                  </p>
                  <span className="rounded-sm bg-ink/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-ink/80">
                    {rankLabel}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-xs text-ink/60">
              {xpThisLevel}/{xpNeeded} XP · {xpToNext} to next SR
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-sm bg-sand">
            <div
              className="h-2 rounded-sm bg-ink"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <label className="block text-sm font-semibold text-ink">
          Gamertag
          <input
            name="gamertag"
            defaultValue={user.gamertag ?? ""}
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
            defaultValue={user.email ?? ""}
            required
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
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
              {user.gamertag}
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

