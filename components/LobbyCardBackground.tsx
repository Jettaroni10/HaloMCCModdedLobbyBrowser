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
      <div className="absolute inset-0 z-10 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
    </>
  );
}
