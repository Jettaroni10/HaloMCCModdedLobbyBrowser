"use client";

import Script from "next/script";
import { useAnalyticsConsent } from "./useAnalyticsConsent";
import { isAnalyticsEnabled } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID?.trim();
const DEBUG_MODE =
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "true" ||
  process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === "1";

export default function AnalyticsLoader() {
  const { analyticsEnabled } = useAnalyticsConsent();
  const enabled = analyticsEnabled && isAnalyticsEnabled();

  if (!enabled || !GA_ID) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){window.dataLayer && window.dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { send_page_view: false, debug_mode: ${DEBUG_MODE} });
        `}
      </Script>
    </>
  );
}
