export default function LoginPage() {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink/70">
        Use your handle or email to access your profile.
      </p>

      <form
        action="/api/auth/login"
        method="post"
        className="mt-6 space-y-4 rounded-3xl border border-ink/10 bg-sand p-6"
      >
        <label className="block text-sm font-semibold text-ink">
          Handle
          <input
            name="handle"
            type="text"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <div className="text-center text-xs uppercase tracking-[0.3em] text-ink/40">
          or
        </div>
        <label className="block text-sm font-semibold text-ink">
          Email
          <input
            name="email"
            type="email"
            className="mt-2 w-full rounded-xl border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
