"use client";

type OverlayHeaderControlsProps = {
  checkingUpdates: boolean;
  updateBusy: boolean;
  onCheckUpdates: () => void;
  onMinimize: () => void;
  onClose: () => void;
};

const baseButton =
  "flex h-8 items-center justify-center rounded-sm border border-ink/25 bg-mist/80 text-ink/85 transition hover:border-ink/50 hover:bg-mist/95 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50 disabled:opacity-60";

export default function OverlayHeaderControls({
  checkingUpdates,
  updateBusy,
  onCheckUpdates,
  onMinimize,
  onClose,
}: OverlayHeaderControlsProps) {
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
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-red-400/60 bg-red-500/25 text-red-100 transition hover:border-red-300 hover:bg-red-500/40 hover:text-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/60"
        aria-label="Close overlay"
      >
        <span className="text-sm font-semibold">×</span>
      </button>
    </div>
  );
}
