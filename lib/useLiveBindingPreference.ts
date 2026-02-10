"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "hmcc_live_binding";

function readStoredPreference() {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "1") return true;
  if (stored === "0") return false;
  return null;
}

export function useLiveBindingPreference(defaultValue = true) {
  const [liveBindingPreference, setLiveBindingPreference] =
    useState<boolean>(defaultValue);

  useEffect(() => {
    const stored = readStoredPreference();
    if (typeof stored === "boolean") {
      setLiveBindingPreference(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      STORAGE_KEY,
      liveBindingPreference ? "1" : "0"
    );
  }, [liveBindingPreference]);

  return { liveBindingPreference, setLiveBindingPreference };
}
