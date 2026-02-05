"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

type ProfileViewTrackerProps = {
  section?: "identity" | "preferences";
};

export default function ProfileViewTracker({
  section = "identity",
}: ProfileViewTrackerProps) {
  useEffect(() => {
    trackEvent("profile_viewed", { section });
  }, [section]);

  return null;
}
