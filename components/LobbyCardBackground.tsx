type LobbyCardBackgroundProps = {
  imageUrl?: string | null;
  fallbackUrl?: string;
};

export default function LobbyCardBackground({
  imageUrl,
  fallbackUrl = "/images/map-placeholder.webp",
}: LobbyCardBackgroundProps) {
  const hasRealImage = Boolean(imageUrl);
  const src = imageUrl ?? fallbackUrl;

  return (
    <>
      {hasRealImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-[#081826]/35" />
      )}
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
    </>
  );
}
