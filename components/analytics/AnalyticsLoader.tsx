"use client";

import Script from "next/script";
import { useAnalyticsConsent } from "./useAnalyticsConsent";

const GA_ID =
  process.env.NEXT_PUBLIC_GA_ID?.trim() || "G-4WCN580TG8";

export default function AnalyticsLoader() {
  const { analyticsEnabled } = useAnalyticsConsent();

  if (!analyticsEnabled || !GA_ID) {
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
          gtag('config', '${GA_ID}', { send_page_view: false });
        `}
      </Script>
    </>
  );
}
