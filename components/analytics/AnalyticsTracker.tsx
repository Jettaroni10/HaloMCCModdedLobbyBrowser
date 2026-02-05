"use client";

import { useEffect } from "react";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import usePageView from "./usePageView";
import { trackEvent } from "@/lib/analytics";

export default function AnalyticsTracker() {
  const { analyticsEnabled } = useAnalyticsConsent();

  usePageView();

  useEffect(() => {
    if (!analyticsEnabled) return;
    trackEvent("session_started");

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        trackEvent("session_ended");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [analyticsEnabled]);

  return null;
}
