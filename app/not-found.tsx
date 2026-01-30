import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-4 px-6 py-16">
      <p className="text-xs uppercase tracking-[0.4em] text-ink/50">
        404
      </p>
      <h1 className="text-3xl font-semibold text-ink">Lobby not found</h1>
      <p className="text-sm text-ink/70">
        The lobby link might be stale or unpublished. Browse live listings for
        active sessions.
      </p>
      <Link
        href="/browse"
        className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
      >
        Back to browse
      </Link>
    </div>
  );
}
