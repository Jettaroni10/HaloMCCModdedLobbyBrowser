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
  const [useCustomImage, setUseCustomImage] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (useCustomImage !== null) return;
    setUseCustomImage(Boolean(currentUrl));
  }, [currentUrl, useCustomImage]);

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
        return false;
      }
      setCurrentUrl(null);
      setSuccess("Image removed.");
      return true;
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
        {currentUrl && useCustomImage && (
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

      <label className="flex items-center gap-2 text-xs font-semibold text-ink/60">
        <input
          type="checkbox"
          checked={Boolean(useCustomImage)}
          onChange={(event) => {
            const next = event.target.checked;
            setUseCustomImage(next);
            if (!next && currentUrl) {
              void handleRemove().then((ok) => {
                if (!ok) {
                  setUseCustomImage(true);
                }
              });
            }
          }}
          className="h-3.5 w-3.5 rounded border-ink/20"
        />
        Use custom lobby image
      </label>

      {useCustomImage && currentUrl && <MapPreview imageUrl={currentUrl} />}

      {useCustomImage && (
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
      )}
    </div>
  );
}
