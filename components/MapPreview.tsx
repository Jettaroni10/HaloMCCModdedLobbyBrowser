type MapPreviewProps = {
  imageUrl?: string | null;
  editable?: boolean;
};

export default function MapPreview({ imageUrl }: MapPreviewProps) {
  const src = imageUrl ?? "/images/map-placeholder.webp";
  const isPlaceholder = !imageUrl;

  return (
    <div className="relative overflow-hidden rounded-md border border-ink/10 bg-ink/80">
      <div className="aspect-[16/9]">
        <img
          src={src}
          alt="Map preview"
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
      {isPlaceholder && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-ink/50 text-center text-sm uppercase tracking-[0.3em] text-sand/80">
          <span>No map image available</span>
          <span className="mt-2 text-[10px] tracking-[0.25em] text-sand/60">
            Host has not uploaded a preview
          </span>
        </div>
      )}
    </div>
  );
}
