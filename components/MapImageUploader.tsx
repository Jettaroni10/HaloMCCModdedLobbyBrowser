"use client";

import { useEffect, useState } from "react";
import MapPreview from "./MapPreview";
import ImageCropUpload from "@/components/ImageCropUpload";

type MapImageUploaderProps = {
  lobbyId: string;
};

export default function MapImageUploader({ lobbyId }: MapImageUploaderProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadUrl() {
      const response = await fetch(`/api/lobbies/${lobbyId}/map-image`);
      if (!response.ok) return;
      const payload = (await response.json()) as { url?: string | null };
      if (active) {
        setCurrentUrl(payload.url ?? null);
      }
    }
    void loadUrl();
    return () => {
      active = false;
    };
  }, [lobbyId]);

  function handleUploaded(url: string | null) {
    setCurrentUrl(url);
    setSuccess("Image uploaded.");
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/lobbies/${lobbyId}/map-image/remove`, {
        method: "POST",
      });
      if (!response.ok) {
        setError("Failed to remove image.");
        return;
      }
      setCurrentUrl(null);
      setSuccess("Image removed.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-ink/10 bg-sand p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">Map image</p>
          <p className="text-xs text-ink/60">
            Optional. JPG, PNG, or WebP up to 5 MB.
          </p>
        </div>
        {currentUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={busy}
            className="rounded-sm border border-clay/40 px-3 py-1 text-xs font-semibold text-clay disabled:opacity-60"
          >
            Remove image
          </button>
        )}
      </div>

      <MapPreview imageUrl={currentUrl} />

      <div className="flex flex-wrap items-center gap-3">
        <ImageCropUpload
          aspect={16 / 9}
          maxWidth={1280}
          maxHeight={720}
          uploadUrl={`/api/lobbies/${lobbyId}/map-image/upload`}
          label="Choose map image"
          onUploaded={handleUploaded}
          onError={(message) => {
            setError(message);
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
