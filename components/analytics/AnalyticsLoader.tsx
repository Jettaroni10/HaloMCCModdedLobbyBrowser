"use client";

import Script from "next/script";
import { useEffect } from "react";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import { isAnalyticsEnabled } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const DEBUG_MODE =
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true" ||
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";

export default function AnalyticsLoader() {
  const { analyticsEnabled } = useAnalyticsConsent();
  const enabled = analyticsEnabled && isAnalyticsEnabled();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!enabled || !GA_ID) return;
    const w = window as typeof window & {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    w.dataLayer = w.dataLayer || [];
    const gtag = (...args: unknown[]) => {
      if (Array.isArray(w.dataLayer)) {
        w.dataLayer.push(args);
      }
    };
    w.gtag = w.gtag || gtag;
    w.gtag("js", new Date());
    w.gtag("config", GA_ID, {
      send_page_view: false,
      debug_mode: DEBUG_MODE,
    });
  }, [enabled]);

  if (!enabled || !GA_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
    </>
  );
}
