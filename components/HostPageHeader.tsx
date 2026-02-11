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
      <div className="mb-6 border-b border-[#1b2a3a] pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
              My Session
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Go live to publish your current session. Details update
              automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 border-b border-[#1b2a3a] pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100 tracking-tight">
            Host dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Publish opt-in listings and manage invite requests.
          </p>
        </div>
        <Link
          href="/host/new"
          className="rounded-none border border-[#1b2a3a] bg-[#0b1a2a] px-6 py-2 text-sm font-semibold text-slate-100 hover:bg-[#0f2236]"
        >
          Create lobby
        </Link>
      </div>
    </div>
  );
}
