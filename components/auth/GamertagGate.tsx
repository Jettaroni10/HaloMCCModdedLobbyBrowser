"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/auth";

const ALLOWED_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/complete-profile",
  "/legal",
]);

type GamertagGateProps = {
  user: SessionUser | null;
};

export default function GamertagGate({ user }: GamertagGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    if (ALLOWED_PATHS.has(pathname)) return;
    if (!user.gamertag || user.needsGamertag) {
      const nextParam = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : "");
      router.replace(
        `/complete-profile?next=${encodeURIComponent(nextParam)}`
      );
    }
  }, [pathname, searchParams, router, user]);

  return null;
}
