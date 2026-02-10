"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { OverlayTelemetryState } from "@/lib/useOverlayTelemetry";
import type { ServerTelemetryState } from "@/lib/useLobbyServerTelemetry";

export type TelemetrySource = "local" | "server";

export type OverlayTelemetrySnapshot = {
  selectedLobbyId: string | null;
  telemetrySource: TelemetrySource;
  liveBindingEnabled: boolean;
  localTelemetry: OverlayTelemetryState | null;
  serverTelemetry: ServerTelemetryState | null;
  localLastReceiveAt: number | null;
  serverLastUpdateAt: number | null;
};

export const DEFAULT_OVERLAY_TELEMETRY_STATE: OverlayTelemetrySnapshot = {
  selectedLobbyId: null,
  telemetrySource: "server",
  liveBindingEnabled: false,
  localTelemetry: null,
  serverTelemetry: null,
  localLastReceiveAt: null,
  serverLastUpdateAt: null,
};

type OverlayTelemetryContextValue = {
  state: OverlayTelemetrySnapshot;
  setState: Dispatch<SetStateAction<OverlayTelemetrySnapshot>>;
};

const OverlayTelemetryContext = createContext<OverlayTelemetryContextValue | null>(
  null
);

export function OverlayTelemetryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<OverlayTelemetrySnapshot>(
    DEFAULT_OVERLAY_TELEMETRY_STATE
  );
  const value = useMemo(() => ({ state, setState }), [state]);

  return (
    <OverlayTelemetryContext.Provider value={value}>
      {children}
    </OverlayTelemetryContext.Provider>
  );
}

export function useOverlayTelemetryContext() {
  const context = useContext(OverlayTelemetryContext);
  if (!context) {
    return {
      state: DEFAULT_OVERLAY_TELEMETRY_STATE,
      setState: () => {},
    } as OverlayTelemetryContextValue;
  }
  return context;
}
