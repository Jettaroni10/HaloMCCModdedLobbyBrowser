"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type NotificationsDrawerContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (next: boolean) => void;
};

const NotificationsDrawerContext =
  createContext<NotificationsDrawerContextValue | null>(null);

export function NotificationsDrawerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const value = useMemo(
    () => ({
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((prev) => !prev),
      setOpen: (next: boolean) => setIsOpen(Boolean(next)),
    }),
    [isOpen]
  );

  return (
    <NotificationsDrawerContext.Provider value={value}>
      {children}
    </NotificationsDrawerContext.Provider>
  );
}

export function useNotificationsDrawer() {
  const context = useContext(NotificationsDrawerContext);
  if (!context) {
    throw new Error(
      "useNotificationsDrawer must be used within NotificationsDrawerProvider."
    );
  }
  return context;
}
