export default function SignupPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Create account</h1>
      <p className="mt-2 text-sm text-ink/70">
        Create a profile with a unique handle to publish and request invites.
      </p>

      <form
        action="/api/auth/signup"
        method="post"
        className="mt-6 space-y-4 rounded-3xl border border-ink/10 bg-sand p-6"
      >
        <label className="block text-sm font-semibold text-ink">
          Handle
          <input
            name="handle"
            type="text"
            required
            placeholder="unique-handle"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Display name
          <input
            name="displayName"
            type="text"
            required
            placeholder="Host or player name"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email (optional)
          <input
            name="email"
            type="email"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Steam name (optional)
          <input
            name="steamName"
            type="text"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Xbox gamertag (optional)
          <input
            name="xboxGamertag"
            type="text"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Create account
        </button>
      </form>
    </div>
  );
}
