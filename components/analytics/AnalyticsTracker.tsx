"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { analyticsEnabled } = useAnalyticsConsent();
  const lastUrlRef = useRef<string | null>(null);

  const url = useMemo(() => {
    const search = searchParams?.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!analyticsEnabled) return;
    if (!url || lastUrlRef.current === url) return;
    lastUrlRef.current = url;

    window.gtag?.("event", "page_view", { page_path: url });
  }, [analyticsEnabled, url]);

  return null;
}
