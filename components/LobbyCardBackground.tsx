"use client";

import { useEffect, useState } from "react";
import FadeInImage from "./FadeInImage";

type LobbyCardBackgroundProps = {
  imageUrl?: string | null;
};

export default function LobbyCardBackground({
  imageUrl,
}: LobbyCardBackgroundProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  const hasRealImage = Boolean(imageUrl) && !failed;

  return (
    <>
      <div className="absolute inset-0 z-0 bg-sand" />
      {hasRealImage && (
        <FadeInImage
          src={imageUrl ?? ""}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 z-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {/* Overlay layers (global tint + side shading + bottom shading). */}
      <div className="pointer-events-none absolute inset-0 z-10 bg-[#070c12]/35" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,rgba(7,12,18,0.95)_0%,rgba(7,12,18,0.80)_35%,rgba(7,12,18,0.80)_65%,rgba(7,12,18,0.95)_100%)]" />
      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(0deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.25)_30%,rgba(0,0,0,0.00)_55%)]" />
    </>
  );
}
