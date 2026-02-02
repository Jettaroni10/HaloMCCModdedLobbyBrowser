export type CropPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

export async function getCroppedImageBlob(options: {
  imageSrc: string;
  crop: CropPixels;
  maxWidth: number;
  maxHeight: number;
  mimeType: string;
  quality?: number;
}) {
  const { imageSrc, crop, maxWidth, maxHeight, mimeType, quality = 0.9 } =
    options;
  const image = await loadImage(imageSrc);

  const safeWidth = Math.max(1, crop.width);
  const safeHeight = Math.max(1, crop.height);
  const scale = Math.min(1, maxWidth / safeWidth, maxHeight / safeHeight);

  const outputWidth = Math.round(safeWidth * scale);
  const outputHeight = Math.round(safeHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported.");
  }

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    safeWidth,
    safeHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      (result) => resolve(result),
      mimeType,
      mimeType === "image/jpeg" ? quality : undefined
    );
  });

  if (!blob) {
    throw new Error("Failed to crop image.");
  }

  return blob;
}

