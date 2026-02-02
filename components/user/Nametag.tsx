"use client";

import SocialRankBadge from "@/components/rank/SocialRankBadge";
import { rankToLabel } from "@/lib/ranks";
import { nameplateTextColor, resolveNametagColor } from "@/lib/reach-colors";

type NametagProps = {
  gamertag: string;
  rank?: number | null;
  nametagColor?: string | null;
  className?: string;
};

export default function Nametag({
  gamertag,
  rank,
  nametagColor,
  className,
}: NametagProps) {
  const resolvedColor = nametagColor
    ? resolveNametagColor(nametagColor)
    : undefined;
  const textColor = resolvedColor ? nameplateTextColor(resolvedColor) : undefined;

  return (
    <div
      className={`flex min-w-0 items-center gap-3 rounded-sm border border-white/10 px-3 py-2 ${
        className ?? ""
      }`}
      style={
        resolvedColor
          ? { backgroundColor: resolvedColor, color: textColor }
          : undefined
      }
    >
      <SocialRankBadge rank={rank} size={20} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {gamertag}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em]">
        {rankToLabel(rank)}
      </span>
    </div>
  );
}
