"use client";

type DownscaleOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

export async function downscaleImageFile(
  file: File,
  options: DownscaleOptions = {}
) {
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 900;
  const quality = options.quality ?? 0.86;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      maxWidth / bitmap.width,
      maxHeight / bitmap.height
    );
    if (scale >= 1) {
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    if (!blob) {
      return file;
    }
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
    });
  } catch {
    return file;
  }
}
