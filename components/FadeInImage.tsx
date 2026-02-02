"use client";

import { useEffect, useState } from "react";

type FadeInImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onError?: () => void;
};

export default function FadeInImage({
  src,
  alt,
  className,
  loading = "lazy",
  referrerPolicy,
  onError,
}: FadeInImageProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      referrerPolicy={referrerPolicy}
      onLoad={() => setLoaded(true)}
      onError={() => onError?.()}
      className={`${className ?? ""} transition-opacity duration-500 ease-out ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
