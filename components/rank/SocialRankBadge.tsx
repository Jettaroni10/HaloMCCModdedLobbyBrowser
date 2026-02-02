"use client";

import { rankToIconSrc, rankToLabel } from "@/lib/ranks";

type SocialRankBadgeProps = {
  rank: number | null | undefined;
  size?: number;
  showLabel?: boolean;
  className?: string;
};

export default function SocialRankBadge({
  rank,
  size = 20,
  showLabel = false,
  className,
}: SocialRankBadgeProps) {
  const label = rankToLabel(rank);
  return (
    <span
      className={`inline-flex items-center gap-2 ${className ?? ""}`}
      aria-label={label}
    >
      <img
        src={rankToIconSrc(rank)}
        alt={label}
        width={size}
        height={size}
        className="shrink-0"
      />
      {showLabel && (
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
          {label}
        </span>
      )}
    </span>
  );
}
