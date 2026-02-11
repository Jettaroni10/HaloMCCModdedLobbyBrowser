"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function HostPageHeader() {
  const [isOverlayEnv, setIsOverlayEnv] = useState(false);

  useEffect(() => {
    const bridge = (window as unknown as { hmccOverlay?: unknown }).hmccOverlay;
    setIsOverlayEnv(Boolean(bridge));
  }, []);

  if (isOverlayEnv) {
    return (
      <div className="border-b border-slate-800/80 pb-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-ink tracking-tight">
              My Session
            </h1>
            <p className="mt-2 text-sm text-ink/70">
              Go live to publish your current session. Details update
              automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-800/80 pb-4 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-ink tracking-tight">
            Host dashboard
          </h1>
          <p className="mt-2 text-sm text-ink/70">
            Publish opt-in listings and manage invite requests.
          </p>
        </div>
        <Link
          href="/host/new"
          className="rounded-sm bg-ink px-6 py-2 text-sm font-semibold text-sand hover:bg-ink/90"
        >
          Create lobby
        </Link>
      </div>
    </div>
  );
}
