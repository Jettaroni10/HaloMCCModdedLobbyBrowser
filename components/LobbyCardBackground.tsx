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
      <div className="absolute inset-0 z-10 bg-[#071a33]/35" />
      <div className="absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(7,26,51,1)_0%,rgba(7,26,51,0.65)_35%,rgba(7,26,51,0.65)_65%,rgba(7,26,51,1)_100%)]" />
      <div className="absolute inset-0 z-10 bg-[linear-gradient(0deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_30%,rgba(0,0,0,0.00)_55%)]" />
    </>
  );
}
