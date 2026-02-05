"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

type CompleteProfileFormProps = {
  initialGamertag?: string | null;
};

export default function CompleteProfileForm({
  initialGamertag,
}: CompleteProfileFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams?.get("next") || "/browse";
  const [gamertag, setGamertag] = useState(initialGamertag ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/gamertag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gamertag }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Unable to save gamertag.");
        trackEvent("profile_updated", {
          section: "identity",
          success: false,
        });
        return;
      }
      trackEvent("profile_updated", {
        section: "identity",
        success: true,
      });
      router.replace(nextParam);
      router.refresh();
    } catch {
      setError("Unable to save gamertag.");
      trackEvent("profile_updated", {
        section: "identity",
        success: false,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 space-y-4 rounded-md border border-ink/10 bg-sand p-6"
    >
      {error && (
        <div className="rounded-sm border border-clay/40 bg-mist px-3 py-2 text-xs text-clay">
          {error}
        </div>
      )}
      <label className="block text-sm font-semibold text-ink">
        Gamertag
        <input
          name="gamertag"
          type="text"
          required
          minLength={3}
          value={gamertag}
          onChange={(event) => setGamertag(event.target.value)}
          className="mt-2 w-full rounded-sm border border-ink/10 bg-mist px-3 py-2 text-sm"
        />
      </label>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
      >
        {loading ? "Saving..." : "Save gamertag"}
      </button>
    </form>
  );
}
