type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_fields: "Gamertag, email, and password are required.",
  gamertag_taken: "That gamertag is already in use.",
  email_taken: "That email is already in use.",
  server: "Server error. Please try again.",
};

export default function SignupPage({ searchParams }: PageProps) {
  const errorParam = Array.isArray(searchParams?.error)
    ? searchParams?.error[0]
    : searchParams?.error;
  const errorMessage = errorParam ? ERROR_MESSAGES[errorParam] : null;
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-3xl font-semibold text-ink">Create account</h1>
      <p className="mt-2 text-sm text-ink/70">
        Your gamertag is your identity for invites and roster listings.
      </p>

      <form
        action="/api/auth/signup"
        method="post"
        className="mt-6 space-y-4 rounded-md border border-ink/10 bg-sand p-6"
      >
        {errorMessage && (
          <div className="rounded-sm border border-clay/40 bg-mist px-3 py-2 text-xs text-clay">
            {errorMessage}
          </div>
        )}
        <label className="block text-sm font-semibold text-ink">
          Gamertag
          <input
            name="gamertag"
            type="text"
            required
            placeholder="Your gamertag"
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Email
          <input
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          Password
          <input
            name="password"
            type="password"
            required
            className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Create account
        </button>
      </form>
    </div>
  );
}

