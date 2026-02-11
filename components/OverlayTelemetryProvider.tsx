"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  useOverlayTelemetry,
  type OverlayTelemetryState,
} from "@/lib/useOverlayTelemetry";
import type { ServerTelemetryState } from "@/lib/useLobbyServerTelemetry";

export type DisplayTelemetryState = {
  map?: string;
  mode?: string;
  currentPlayers?: number;
  status?: string;
  seq?: number;
  emittedAt?: string;
  updatedAt?: string;
};

export type TelemetrySource = "local" | "server" | "manual";

export type OverlayTelemetrySnapshot = {
  selectedLobbyId: string | null;
  currentUserId: string | null;
  selectedLobbyHostId: string | null;
  overlayConnected: boolean;
  telemetrySource: TelemetrySource;
  liveBindingEnabled: boolean;
  localTelemetry: OverlayTelemetryState | null;
  serverTelemetry: ServerTelemetryState | null;
  manualTelemetry: ServerTelemetryState | null;
  displayTelemetry: DisplayTelemetryState | null;
  localLastReceiveAt: number | null;
  serverLastUpdateAt: number | null;
  lastPublishStatus: {
    statusCode: number | null;
    ok: boolean | null;
    at: number | null;
  } | null;
};

export const DEFAULT_OVERLAY_TELEMETRY_STATE: OverlayTelemetrySnapshot = {
  selectedLobbyId: null,
  currentUserId: null,
  selectedLobbyHostId: null,
  overlayConnected: false,
  telemetrySource: "server",
  liveBindingEnabled: false,
  localTelemetry: null,
  serverTelemetry: null,
  manualTelemetry: null,
  displayTelemetry: null,
  localLastReceiveAt: null,
  serverLastUpdateAt: null,
  lastPublishStatus: null,
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
  const { isConnected, localTelemetry, lastReceiveAt } = useOverlayTelemetry();

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      overlayConnected: isConnected,
      localTelemetry,
      localLastReceiveAt: lastReceiveAt,
    }));
  }, [isConnected, localTelemetry, lastReceiveAt]);

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
