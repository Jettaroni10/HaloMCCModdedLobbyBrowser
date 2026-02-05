"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { bucketDuration, getPageInfo, trackEvent, trackPageView } from "@/lib/analytics";

export default function usePageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrlRef = useRef<string | null>(null);
  const activeUrlRef = useRef<string | null>(null);
  const activeCategoryRef = useRef<string | null>(null);
  const startRef = useRef<number>(Date.now());
  const reportedUrlRef = useRef<string | null>(null);

  const url = useMemo(() => {
    const search = searchParams?.toString();
    return search ? `${pathname}?${search}` : pathname;
  }, [pathname, searchParams]);

  function reportTimeSpent(reason: string) {
    const activeUrl = activeUrlRef.current;
    if (!activeUrl || reportedUrlRef.current === activeUrl) return;
    const duration = Date.now() - startRef.current;
    trackEvent("time_on_page_bucketed", {
      duration_bucket: bucketDuration(duration),
      page_category: activeCategoryRef.current ?? undefined,
      reason,
    });
    reportedUrlRef.current = activeUrl;
  }

  useEffect(() => {
    if (!url) return;
    if (lastUrlRef.current === url) return;
    reportTimeSpent("navigation");

    const pageInfo = getPageInfo(pathname);
    trackPageView({
      page_path: url,
      page_title: pageInfo.title,
      page_category: pageInfo.category,
    });

    lastUrlRef.current = url;
    activeUrlRef.current = url;
    activeCategoryRef.current = pageInfo.category;
    startRef.current = Date.now();
    reportedUrlRef.current = null;
  }, [pathname, url]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        reportTimeSpent("visibility_hidden");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);
}
