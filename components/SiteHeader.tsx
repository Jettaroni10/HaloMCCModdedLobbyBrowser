import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import HostNavLink from "@/components/HostNavLink";
import SocialRankBadge from "@/components/rank/SocialRankBadge";

type SiteHeaderProps = {
  user: SessionUser | null;
  isAdmin: boolean;
};

export default function SiteHeader({ user, isAdmin }: SiteHeaderProps) {
  return (
    <header className="border-b border-ink/10 bg-sand/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-sm bg-clay text-ink flex items-center justify-center font-semibold">
            CR
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-ink/50">
              Customs on the Ring
            </p>
            <p className="text-lg font-semibold text-ink">
              Halo MCC Customs
            </p>
          </div>
        </div>
        <nav className="flex items-center gap-5 text-sm font-medium">
          <Link href="/" className="hover:text-ink/80">
            Browse
          </Link>
          <HostNavLink hostUserId={user?.id ?? null} />
          {user && (
            <Link href="/friends" className="hover:text-ink/80">
              Friends
            </Link>
          )}
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
                <span>{user.gamertag || "Profile"}</span>
                <SocialRankBadge
                  rank={user.srLevel ?? 1}
                  size={16}
                  showLabel={true}
                  className="ml-3 text-ink/70"
                />
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-sm border border-ink/20 px-4 py-1.5 text-ink hover:border-ink/40"
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
                className="rounded-sm bg-ink px-4 py-1.5 text-sand hover:bg-ink/90"
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

