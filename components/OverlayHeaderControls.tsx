"use client";

import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";

type OverlayHeaderControlsProps = {
  checkingUpdates: boolean;
  updateBusy: boolean;
  onCheckUpdates: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

export default function OverlayHeaderControls({
  checkingUpdates,
  updateBusy,
  onCheckUpdates,
  onMinimize,
  onClose,
}: OverlayHeaderControlsProps) {
  const baseButton = `flex h-8 items-center justify-center rounded-sm transition ${OverlayThemeClasses.buttonGhost} ${OverlayThemeClasses.focusRing} disabled:opacity-60`;
  return (
    <div className="pointer-events-auto fixed right-4 top-4 z-[70] flex items-center gap-2">
      <button
        type="button"
        onClick={onCheckUpdates}
        disabled={checkingUpdates || updateBusy}
        className={`${baseButton} gap-2 px-3 text-[10px] font-semibold uppercase tracking-[0.3em]`}
        aria-label="Check for updates"
      >
        {checkingUpdates ? "Checking..." : "Updates"}
      </button>
      <button
        type="button"
        onClick={onMinimize}
        className={`${baseButton} w-8`}
        aria-label="Minimize overlay"
      >
        <span className="block h-[2px] w-3 bg-current" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className={`flex h-8 w-8 items-center justify-center rounded-sm transition ${OverlayThemeClasses.buttonDanger} ${OverlayThemeClasses.focusRing}`}
        aria-label="Close overlay"
      >
        <span className="text-sm font-semibold">×</span>
      </button>
    </div>
  );
}
