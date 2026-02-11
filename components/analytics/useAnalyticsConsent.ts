"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "analytics_consent";

type ConsentValue = "granted" | "denied";

export function useAnalyticsConsent() {
  const [consent, setConsentState] = useState<ConsentValue>("granted");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "denied" || stored === "granted") {
      if (stored !== consent) {
        setConsentState(stored);
      }
    }
  }, [consent]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, consent);
    } catch {
      // ignore storage failures
    }
  }, [consent]);

  const setConsent = (value: ConsentValue) => {
    setConsentState(value);
  };

  return {
    consent,
    analyticsEnabled: consent === "granted",
    setConsent,
  };
}
