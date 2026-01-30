import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-ink/10 bg-sand/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 text-sm text-ink/70">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-base font-semibold text-ink">
            Halo MCC Custom Games Invite Coordinator
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-ink">
              Browse
            </Link>
            <Link href="/host" className="hover:text-ink">
              Host
            </Link>
            <Link href="/legal" className="hover:text-ink">
              Legal
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-ink/10 bg-sand px-4 py-3 text-ink">
          <p className="font-semibold">
            Not affiliated with Microsoft, Xbox, 343 Industries, or Halo.
          </p>
          <p className="text-sm text-ink/70">
            This tool only coordinates invitations and provides helper actions.
            It does not read game state, scan sessions, or send invites for you.
          </p>
        </div>
        <p>
          Lobbies are opt-in and only include what hosts explicitly publish.
          Modded support is limited to metadata and Steam Workshop links.
        </p>
      </div>
    </footer>
  );
}
