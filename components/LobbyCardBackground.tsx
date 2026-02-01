type LobbyCardBackgroundProps = {
  imageUrl?: string | null;
};

export default function LobbyCardBackground({
  imageUrl,
}: LobbyCardBackgroundProps) {
  const hasRealImage = Boolean(imageUrl);

  return (
    <>
      {hasRealImage ? (
        <img
          src={imageUrl ?? ""}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 z-0 bg-slate-900" />
      )}
      {/* Overlay layers (tint + sci-fi gradients). Tune opacities here for legibility. */}
      <div className="absolute inset-0 z-10 bg-[#061326]/45" />
      <div className="absolute inset-0 z-20 bg-gradient-to-r from-[#061326]/85 via-[#061326]/40 to-transparent" />
      <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
    </>
  );
}
