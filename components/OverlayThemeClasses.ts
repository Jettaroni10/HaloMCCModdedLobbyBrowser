"use client";

export const OverlayThemeClasses = {
  surface: "bg-sand/85 text-ink",
  surfaceStrong: "bg-mist/85 text-ink",
  border: "border-ink/20",
  text: "text-ink",
  mutedText: "text-ink/70",
  focusRing: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/50",
  buttonGhost:
    "border border-ink/20 bg-sand/60 text-ink/80 hover:bg-sand/80 hover:border-ink/40 hover:text-ink",
  buttonPrimary:
    "border border-ink/25 bg-mist/90 text-ink hover:bg-mist hover:border-ink/40",
  buttonDanger:
    "border border-clay/50 bg-clay/20 text-ink hover:bg-clay/35 hover:border-clay/80",
  toast: "border border-ink/20 bg-mist/80 text-ink/80",
} as const;
