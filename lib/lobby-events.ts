import { EventEmitter } from "events";

type LobbyMessageCreatedPayload = {
  lobbyId: string;
  message: {
    id: string;
    conversationId: string;
    senderUserId: string;
    senderDisplayName: string;
    body: string;
    createdAt: string;
  };
};

type LobbyRosterUpdatedPayload = {
  lobbyId: string;
};

type LobbyRequestCreatedPayload = {
  lobbyId: string;
  request: {
    id: string;
    requesterUserId: string;
    requesterHandleText: string;
    requesterDisplayName: string;
    createdAt: string;
  };
};

type LobbyEventMap = {
  message_created: LobbyMessageCreatedPayload;
  roster_updated: LobbyRosterUpdatedPayload;
  request_created: LobbyRequestCreatedPayload;
};

const globalForEvents = global as unknown as { lobbyEvents?: EventEmitter };

export const lobbyEvents =
  globalForEvents.lobbyEvents ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.lobbyEvents = lobbyEvents;
}

export function emitLobbyMessageCreated(payload: LobbyMessageCreatedPayload) {
  lobbyEvents.emit("message_created", payload);
}

export function emitLobbyRosterUpdated(payload: LobbyRosterUpdatedPayload) {
  lobbyEvents.emit("roster_updated", payload);
}

export function emitLobbyRequestCreated(payload: LobbyRequestCreatedPayload) {
  lobbyEvents.emit("request_created", payload);
}

export type {
  LobbyEventMap,
  LobbyMessageCreatedPayload,
  LobbyRosterUpdatedPayload,
  LobbyRequestCreatedPayload,
};
