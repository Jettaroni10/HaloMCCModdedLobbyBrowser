"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "analytics_consent";

type ConsentValue = "granted" | "denied";

function readStoredConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "denied" || stored === "granted") {
    return stored;
  }
  return null;
}

export function useAnalyticsConsent() {
  const [consent, setConsentState] = useState<ConsentValue>(() => {
    return readStoredConsent() ?? "granted";
  });

  useEffect(() => {
    const stored = readStoredConsent();
    if (stored && stored !== consent) {
      setConsentState(stored);
    }
  }, [consent]);

  const setConsent = useCallback((value: ConsentValue) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, value);
    }
    setConsentState(value);
  }, []);

  return {
    consent,
    analyticsEnabled: consent === "granted",
    setConsent,
  };
}
