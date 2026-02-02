"use client";

import { useAnalyticsConsent } from "./useAnalyticsConsent";

export default function AnalyticsToggle() {
  const { analyticsEnabled, setConsent } = useAnalyticsConsent();

  return (
    <button
      type="button"
      className="rounded-sm border border-ink/20 bg-mist px-3 py-2 text-xs uppercase tracking-[0.18em] text-ink/80"
      onClick={() => setConsent(analyticsEnabled ? "denied" : "granted")}
    >
      Analytics: {analyticsEnabled ? "On" : "Off"}
    </button>
  );
}
