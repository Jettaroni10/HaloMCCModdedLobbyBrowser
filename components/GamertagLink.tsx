"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type GamertagLinkProps = {
  gamertag: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  title?: string;
  asSpan?: boolean;
};

export default function GamertagLink({
  gamertag,
  className,
  style,
  children,
  title,
  asSpan = false,
}: GamertagLinkProps) {
  const router = useRouter();
  const safeGamertag = gamertag?.trim() ?? "";
  const href = `/users/${encodeURIComponent(safeGamertag)}`;
  if (asSpan) {
    return (
      <span
        role="link"
        tabIndex={0}
        className={className}
        style={style}
        title={title ?? safeGamertag}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          router.push(href);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            router.push(href);
          }
        }}
      >
        {children ?? safeGamertag}
      </span>
    );
  }

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
