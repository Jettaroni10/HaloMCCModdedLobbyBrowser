"use client";

import Link from "next/link";

type GamertagLinkProps = {
  gamertag: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  title?: string;
};

export default function GamertagLink({
  gamertag,
  className,
  style,
  children,
  title,
}: GamertagLinkProps) {
  const safeGamertag = gamertag?.trim() ?? "";
  const href = `/users/${encodeURIComponent(safeGamertag)}`;
  return (
    <Link
      href={href}
      className={className}
      style={style}
      title={title ?? safeGamertag}
    >
      {children ?? safeGamertag}
    </Link>
  );
}
