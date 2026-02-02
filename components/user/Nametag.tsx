"use client";

import SocialRankBadge from "@/components/rank/SocialRankBadge";
import GamertagLink from "@/components/GamertagLink";
import { clampRank } from "@/lib/ranks";
import { nameplateTextColor, resolveNametagColor } from "@/lib/reach-colors";

type NametagProps = {
  gamertag: string;
  rank?: number | null;
  nametagColor?: string | null;
  className?: string;
  iconSize?: number;
};

export default function Nametag({
  gamertag,
  rank,
  nametagColor,
  className,
  iconSize,
}: NametagProps) {
  const resolvedColor = nametagColor
    ? resolveNametagColor(nametagColor)
    : undefined;
  const textColor = resolvedColor ? nameplateTextColor(resolvedColor) : undefined;
  const rankValue = clampRank(rank);
  const rankLabel = `sr${rankValue}`;

  return (
    <div
      className={`flex min-w-0 items-center gap-4 rounded-sm border border-white/10 px-4 py-3 ${
        className ?? ""
      }`}
      style={
        resolvedColor
          ? { backgroundColor: resolvedColor, color: textColor }
          : undefined
      }
    >
      <SocialRankBadge rank={rankValue} size={iconSize ?? 26} />
      <GamertagLink
        gamertag={gamertag}
        className="min-w-0 flex-1 truncate text-base font-semibold"
      />
      <span className="rounded-sm bg-black/35 px-2 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
        {rankLabel}
      </span>
    </div>
  );
}
