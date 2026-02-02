"use client";

import FadeInImage from "@/components/FadeInImage";

type SpartanPortraitProps = {
  imageUrl?: string | null;
  className?: string;
  label?: string;
};

export default function SpartanPortrait({
  imageUrl,
  className,
  label = "Spartan portrait",
}: SpartanPortraitProps) {
  const hasImage = Boolean(imageUrl);
  return (
    <div
      className={`relative aspect-[3/4] w-full overflow-hidden rounded-sm border border-ink/15 bg-gradient-to-b from-mist/60 via-mist/20 to-sand/80 ${
        className ?? ""
      }`}
    >
      {hasImage ? (
        <FadeInImage
          src={imageUrl as string}
          alt={label}
          className="absolute inset-0 h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-[0.4em] text-ink/50">
          {label}
        </div>
      )}
    </div>
  );
}
