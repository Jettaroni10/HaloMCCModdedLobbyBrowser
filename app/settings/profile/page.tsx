import { requireAuth } from "@/lib/auth";

export default async function ProfilePage() {
  const user = await requireAuth();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Profile settings</h1>
      <p className="mt-2 text-sm text-ink/70">
        Keep your profile light. Hosts can share extra details in each lobby.
      </p>

      <form
        action="/api/profile"
        method="post"
        className="mt-6 space-y-5 rounded-3xl border border-ink/10 bg-sand p-6"
      >
        <label className="block text-sm font-semibold text-ink">
          Display name
          <input
            name="displayName"
            defaultValue={user.displayName ?? ""}
            placeholder="Your host or player name"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Steam name
          <input
            name="steamName"
            defaultValue={user.steamName ?? ""}
            placeholder="Optional"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Xbox gamertag
          <input
            name="xboxGamertag"
            defaultValue={user.xboxGamertag ?? ""}
            placeholder="Optional"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>

        <div className="rounded-2xl border border-ink/10 bg-mist px-4 py-3 text-sm text-ink/70">
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
          className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Save changes
        </button>
      </form>
    </div>
  );
}
