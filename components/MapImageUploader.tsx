"use client";

import { useEffect, useRef, useState } from "react";
import MapPreview from "./MapPreview";
import { downscaleImageFile } from "@/lib/image-client";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type MapImageUploaderProps = {
  lobbyId: string;
};

export default function MapImageUploader({ lobbyId }: MapImageUploaderProps) {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  async function handleUpload(file: File) {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Unsupported image format. Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large. Max 5 MB.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      const prepared = await downscaleImageFile(file);
      const formData = new FormData();
      formData.append("file", prepared, prepared.name);
      const response = await fetch(`/api/lobbies/${lobbyId}/map-image/upload`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error ?? "Upload failed.");
        return;
      }
      const payload = (await response.json().catch(() => null)) as
        | { url?: string | null }
        | null;
      setCurrentUrl(payload?.url ?? null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setBusy(false);
    }
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-xs text-ink/70"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void handleUpload(file);
            }
          }}
          disabled={busy}
        />
        {busy && (
          <span className="text-xs uppercase tracking-[0.3em] text-ink/50">
            Uploading…
          </span>
        )}
        {error && <span className="text-xs text-clay">{error}</span>}
      </div>
    </div>
  );
}
