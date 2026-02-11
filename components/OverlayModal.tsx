"use client";

import type { ReactNode } from "react";
import { OverlayThemeClasses } from "@/components/OverlayThemeClasses";

type OverlayModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
};

export default function OverlayModal({
  open,
  title,
  children,
  actions,
  onClose,
}: OverlayModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-sand/80 px-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-md rounded-md border p-6 shadow-2xl ${OverlayThemeClasses.surfaceStrong} ${OverlayThemeClasses.border}`}
      >
        <h2 className={`text-lg font-semibold ${OverlayThemeClasses.text}`}>
          {title}
        </h2>
        <div className={`mt-2 text-sm ${OverlayThemeClasses.mutedText}`}>
          {children}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          {actions}
        </div>
      </div>
    </div>
  );
}
