"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useHostEvents } from "./useHostEvents";

type HostNotificationsContextValue = ReturnType<typeof useHostEvents>;

const HostNotificationsContext = createContext<HostNotificationsContextValue | null>(
  null
);

type HostNotificationsProviderProps = {
  hostUserId?: string | null;
  children: ReactNode;
};

export default function HostNotificationsProvider({
  hostUserId,
  children,
}: HostNotificationsProviderProps) {
  const value = useHostEvents({
    enabled: Boolean(hostUserId),
    hostUserId,
  });

  return (
    <HostNotificationsContext.Provider value={value}>
      {value.toasts.length > 0 && (
        <div className="fixed right-6 top-6 z-50 space-y-2">
          {value.toasts.map((toast) => (
            <div
              key={toast.id}
              className="rounded-sm border border-ink/20 bg-mist/90 px-4 py-2 text-sm text-ink shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span>{toast.message}</span>
                <button
                  type="button"
                  onClick={() => value.dismissToast(toast.id)}
                  className="text-xs font-semibold text-ink/60"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {children}
    </HostNotificationsContext.Provider>
  );
}

export function useHostNotifications() {
  const context = useContext(HostNotificationsContext);
  if (!context) {
    throw new Error("useHostNotifications must be used within provider.");
  }
  return context;
}
