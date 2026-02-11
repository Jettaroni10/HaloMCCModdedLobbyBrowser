"use client";

import Link from "next/link";
import type { SessionUser } from "@/lib/auth";
import HostNavLink from "@/components/HostNavLink";
import HostNotificationToggle from "@/components/HostNotificationToggle";
import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { clampRank } from "@/lib/ranks";
import SignOutButton from "@/components/auth/SignOutButton";
import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";

type OverlayHeaderProps = {
  user: SessionUser | null;
  isAdmin: boolean;
};

export default function OverlayHeader({ user, isAdmin }: OverlayHeaderProps) {
  return (
    <header
      className={`overlay-style-sentinel border-b backdrop-blur ${OverlayThemeClasses.surface} ${OverlayThemeClasses.border}`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-ink/15 bg-mist/80">
            <img
              src="/logo.svg"
              alt="Customs on the Ring logo"
              className="h-7 w-7"
            />
          </div>
          <div>
            <p className={`text-sm uppercase tracking-[0.3em] ${OverlayThemeClasses.mutedText}`}>
              Customs on the Ring
            </p>
            <p className={`text-lg font-semibold ${OverlayThemeClasses.text}`}>
              Halo MCC Customs
            </p>
          </div>
        </div>
        <nav className={`flex items-center gap-5 text-sm font-medium ${OverlayThemeClasses.mutedText}`}>
          <Link href="/" className="hover:text-ink">
            Browse
          </Link>
          <HostNavLink hostUserId={user?.id ?? null} />
          <HostNotificationToggle userId={user?.id ?? null} />
          {user && (
            <Link href="/friends" className="hover:text-ink">
              Friends
            </Link>
          )}
          <Link href="/legal" className="hover:text-ink">
            Legal
          </Link>
          {isAdmin && (
            <Link href="/admin" className="hover:text-ink">
              Admin
            </Link>
          )}
          {user ? (
            <>
              <Link href="/settings/profile" className="hover:text-ink">
                <span>{user.gamertag || "Profile"}</span>
                <SocialRankBadge
                  rank={user.srLevel ?? 1}
                  size={16}
                  showLabel={false}
                  className="ml-3 text-ink/70"
                />
                <span className="ml-2 rounded-sm bg-clay/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/90">
                  sr{clampRank(user.srLevel)}
                </span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/signup"
                className={`rounded-sm px-4 py-1.5 text-sm font-semibold ${OverlayThemeClasses.buttonPrimary}`}
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
