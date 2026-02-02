"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Cropper, { Area } from "react-easy-crop";
import { getCroppedImageBlob } from "@/lib/imageCrop";

type ImageCropUploadProps = {
  aspect: number;
  maxWidth: number;
  maxHeight: number;
  uploadUrl?: string;
  onUploaded?: (url: string | null) => void;
  onCropped?: (file: File) => void;
  onError?: (message: string) => void;
  label?: string;
};

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

export default function ImageCropUpload({
  aspect,
  maxWidth,
  maxHeight,
  uploadUrl,
  onUploaded,
  onCropped,
  onError,
  label = "Choose image",
}: ImageCropUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>("image/jpeg");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const zoomLabel = useMemo(() => Math.round(zoom * 100), [zoom]);

  const notifyError = useCallback(
    (message: string) => {
      setError(message);
      onError?.(message);
    },
    [onError]
  );

  const onCropComplete = useCallback((_area: Area, pixels: Area) => {
    setCropPixels(pixels);
  }, []);

  const resetState = useCallback(() => {
    setImageSrc(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropPixels(null);
    setBusy(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  async function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      notifyError("Unsupported file type. Choose an image.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      notifyError("Image is too large. Max 10 MB.");
      return;
    }
    setError(null);
    setFileType(file.type === "image/png" ? "image/png" : "image/jpeg");

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
    };
    reader.onerror = () => {
      notifyError("Unable to read file.");
    };
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!imageSrc || !cropPixels) {
      notifyError("Crop not ready.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const blob = await getCroppedImageBlob({
        imageSrc,
        crop: cropPixels,
        maxWidth,
        maxHeight,
        mimeType: fileType,
      });
      const extension = fileType === "image/png" ? "png" : "jpg";
      const file = new File([blob], `crop-${Date.now()}.${extension}`, {
        type: fileType,
      });

      if (onCropped) {
        onCropped(file);
        resetState();
        return;
      }

      if (!uploadUrl) {
        notifyError("Upload URL missing.");
        setBusy(false);
        return;
      }

      const formData = new FormData();
      formData.append("file", file, file.name);
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string | null; error?: string; requestId?: string; stage?: string }
        | null;
      if (!response.ok) {
        let message = payload?.error ?? "Upload failed.";
        if (payload?.requestId) {
          message = `${message} (Request ID: ${payload.requestId}${
            payload.stage ? `, stage: ${payload.stage}` : ""
          })`;
        }
        notifyError(message);
        setBusy(false);
        return;
      }
      onUploaded?.(payload?.url ?? null);
      resetState();
    } catch (err) {
      notifyError(
        err instanceof Error ? err.message : "Unable to crop image."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-ink/20 bg-mist px-3 py-2 text-xs font-semibold text-ink/80">
        <span>{label}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              void handleFileSelect(file);
            }
          }}
        />
      </label>

      {error && <p className="text-xs font-semibold text-clay">{error}</p>}

      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl space-y-4 rounded-md border border-ink/20 bg-sand p-4">
            <div className="relative h-[360px] w-full overflow-hidden rounded-sm border border-ink/10 bg-ink">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                cropShape="rect"
                showGrid={false}
                zoomWithScroll
              />
              <div className="pointer-events-none absolute inset-0 border border-white/20" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-ink/70">
                  Zoom {zoomLabel}%
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetState}
                  disabled={busy}
                  className="rounded-sm border border-ink/30 px-3 py-2 text-xs font-semibold text-ink/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={busy}
                  className="rounded-sm bg-ink px-4 py-2 text-xs font-semibold text-sand"
                >
                  {busy ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
