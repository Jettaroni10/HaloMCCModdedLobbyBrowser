"use client";

import { useState } from "react";
import { signOutFirebase } from "@/lib/firebaseAuth";
import { trackEvent } from "@/lib/analytics";

type SignOutButtonProps = {
  className?: string;
};

export default function SignOutButton({ className }: SignOutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await signOutFirebase();
      trackEvent("logout");
    } finally {
      window.location.href = "/api/auth/logout";
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className={
        className ??
        "rounded-sm border border-ink/20 px-4 py-1.5 text-ink hover:border-ink/40"
      }
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
