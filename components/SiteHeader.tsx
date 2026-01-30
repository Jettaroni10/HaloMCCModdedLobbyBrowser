import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

type SiteHeaderProps = {
  user: SessionUser | null;
  isAdmin: boolean;
};

export default function SiteHeader({ user, isAdmin }: SiteHeaderProps) {
  return (
    <header className="border-b border-ink/10 bg-sand/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-clay text-ink flex items-center justify-center font-semibold">
            IC
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ink/50">
              Invite Coordinator
            </p>
            <p className="text-lg font-semibold text-ink">
              Halo MCC Custom Games
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/" className="hover:text-ink/80">
            Browse
          </Link>
          <Link href="/host" className="hover:text-ink/80">
            Host
          </Link>
          <Link href="/legal" className="hover:text-ink/80">
            Legal
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-ink/80">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/settings/profile" className="hover:text-ink/80">
                {user.displayName || "Profile"}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-ink/20 px-4 py-1.5 text-ink hover:border-ink/40"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-ink/80">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-ink px-4 py-1.5 text-sand hover:bg-ink/90"
              >
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
