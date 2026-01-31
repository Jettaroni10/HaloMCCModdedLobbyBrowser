import { requireAuth } from "@/lib/auth";
import { xpRequired } from "@/lib/xp";
import { ReachColors, resolveNametagColor } from "@/lib/reach-colors";

export default async function ProfilePage() {
  const user = await requireAuth();
  const srLevel = user.srLevel ?? 1;
  const xpThisLevel = user.xpThisLevel ?? 0;
  const xpNeeded = xpRequired(srLevel);
  const xpToNext = Math.max(0, xpNeeded - xpThisLevel);
  const progressPercent =
    xpNeeded > 0 ? Math.min(100, Math.round((xpThisLevel / xpNeeded) * 100)) : 0;
  const selectedColor = resolveNametagColor(user.nametagColor);

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
        <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-ink/50">
                Social rank
              </p>
              <p className="mt-1 text-lg font-semibold text-ink">
                SR{srLevel}
              </p>
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
          Display name
          <input
            name="displayName"
            defaultValue={user.displayName ?? ""}
            placeholder="Your host or player name"
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Steam name
          <input
            name="steamName"
            defaultValue={user.steamName ?? ""}
            placeholder="Optional"
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>

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

        <div className="rounded-sm border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
          <p>
            Handle: <span className="font-semibold text-ink">{user.handle}</span>
          </p>
          <p className="mt-1">
            Email:{" "}
            <span className="font-semibold text-ink">
              {user.email ?? "Not set"}
            </span>
          </p>
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

