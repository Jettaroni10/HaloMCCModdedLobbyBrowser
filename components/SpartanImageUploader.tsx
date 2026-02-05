"use client";

import { useEffect, useState } from "react";
import SpartanPortrait from "@/components/SpartanPortrait";
import ImageCropUpload from "@/components/ImageCropUpload";
import { trackEvent } from "@/lib/analytics";

type SpartanImageUploaderProps = {
  initialUrl?: string | null;
};

export default function SpartanImageUploader({
  initialUrl,
}: SpartanImageUploaderProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(
    initialUrl ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrentUrl(initialUrl ?? null);
  }, [initialUrl]);

  function handleUploaded(url: string | null) {
    setCurrentUrl(url);
    setSuccess("Image uploaded.");
    trackEvent("portrait_uploaded", { success: true });
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/users/me/spartan-image/remove", {
        method: "POST",
      });
      if (!response.ok) {
        setError("Failed to remove image.");
        trackEvent("portrait_removed", { success: false });
        return;
      }
      setCurrentUrl(null);
      setSuccess("Image removed.");
      trackEvent("portrait_removed", { success: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-ink/10 bg-sand/80 p-4 backdrop-blur sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Spartan portrait</p>
          <p className="text-xs text-ink/60">
            Optional. JPG, PNG, or WebP up to 5 MB.
          </p>
        </div>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded-sm border border-clay/40 px-3 py-1 text-xs font-semibold text-clay disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-clay/60"
          >
            Remove
          </button>
        )}
      </div>

      <SpartanPortrait imageUrl={currentUrl} />

      <div className="flex flex-wrap items-center gap-3">
        <ImageCropUpload
          aspect={1}
          maxWidth={512}
          maxHeight={512}
          uploadUrl="/api/users/me/spartan-image/upload"
          label="Choose portrait"
          onUploaded={handleUploaded}
          onError={(message) => {
            setError(message);
            trackEvent("portrait_uploaded", { success: false });
          }}
        />
        {busy && (
          <span className="text-xs uppercase tracking-[0.3em] text-ink/50">
            Uploading…
          </span>
        )}
        {error && <span className="text-xs text-clay">{error}</span>}
        {success && !error && (
          <span className="text-xs text-ink/70">{success}</span>
        )}
      </div>
    </div>
  );
}
