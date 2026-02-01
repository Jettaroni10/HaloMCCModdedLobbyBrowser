import { EventEmitter } from "events";
import { publishHostEvent } from "@/lib/realtime/ablyServer";

type RequestCreatedPayload = {
  hostUserId: string;
  requesterDisplayName: string;
  requesterNametagColor?: string | null;
  request: {
    id: string;
    requesterUserId: string;
    requesterHandleText: string;
    note: string | null;
    confirmedSubscribed: boolean;
    status: "PENDING";
    createdAt: string;
    lobby: {
      id: string;
      title: string;
      isModded: boolean;
    };
  };
};

type LobbyExpiredPayload = {
  hostUserId: string;
  lobby: {
    id: string;
    expiresAt: string;
  };
};

type RequestDecidedPayload = {
  hostUserId: string;
  request: {
    id: string;
    status: "ACCEPTED" | "DECLINED";
    decidedByUserId: string | null;
    lobby: {
      id: string;
      title: string;
    };
  };
};

type HostEventMap = {
  request_created: RequestCreatedPayload;
  request_decided: RequestDecidedPayload;
  lobby_expired: LobbyExpiredPayload;
};

const globalForEvents = global as unknown as { hostEvents?: EventEmitter };

export const hostEvents =
  globalForEvents.hostEvents ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.hostEvents = hostEvents;
}

export function emitRequestCreated(payload: RequestCreatedPayload) {
  hostEvents.emit("request_created", payload);
  void publishHostEvent({
    hostUserId: payload.hostUserId,
    event: "request_created",
    payload,
  });
}

export function emitLobbyExpired(payload: LobbyExpiredPayload) {
  hostEvents.emit("lobby_expired", payload);
  void publishHostEvent({
    hostUserId: payload.hostUserId,
    event: "lobby_expired",
    payload,
  });
}

export function emitRequestDecided(payload: RequestDecidedPayload) {
  hostEvents.emit("request_decided", payload);
  void publishHostEvent({
    hostUserId: payload.hostUserId,
    event: "request_decided",
    payload,
  });
}

export type {
  HostEventMap,
  RequestCreatedPayload,
  LobbyExpiredPayload,
  RequestDecidedPayload,
};
