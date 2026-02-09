const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_DATA = {
  lobbies: [],
  requests: [],
  installedMods: [],
};

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonSafe(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function normalizeMods(mods) {
  if (!Array.isArray(mods)) return [];
  return Array.from(
    new Set(
      mods
        .map((mod) => String(mod || "").trim())
        .filter(Boolean)
        .map((mod) => mod.toLowerCase())
    )
  );
}

class LobbyStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.data = { ...DEFAULT_DATA };
    this.load();
  }

  load() {
    const parsed = readJsonSafe(this.filePath);
    if (parsed && typeof parsed === "object") {
      this.data = {
        ...DEFAULT_DATA,
        ...parsed,
        installedMods: normalizeMods(parsed.installedMods),
      };
    } else {
      this.save();
    }
  }

  save() {
    writeJsonSafe(this.filePath, this.data);
  }

  listLobbies() {
    return [...this.data.lobbies];
  }

  getLobby(id) {
    return this.data.lobbies.find((lobby) => lobby.id === id) || null;
  }

  createLobby(input) {
    const now = new Date().toISOString();
    const lobby = {
      id: crypto.randomUUID(),
      title: String(input.title || "Custom Lobby").trim(),
      game: String(input.game || "MCC").trim(),
      mode: String(input.mode || "Custom").trim(),
      map: String(input.map || "Unknown").trim(),
      playlist: String(input.playlist || "").trim(),
      hostName: String(input.hostName || "Host").trim(),
      sessionId: String(input.sessionId || "").trim(),
      telemetryTimestamp: input.telemetryTimestamp || null,
      maxPlayers: Number(input.maxPlayers || 16),
      currentPlayers: Number(input.currentPlayers || 1),
      isModded: Boolean(input.isModded),
      requiredMods: normalizeMods(input.requiredMods || []),
      modDetails: input.modDetails || {},
      mapInfo: input.mapInfo || null,
      modeInfo: input.modeInfo || null,
      autoPopulated: Boolean(input.autoPopulated),
      isPublic: input.isPublic !== undefined ? Boolean(input.isPublic) : true,
      status: "active",
      source: String(input.source || "manual"),
      createdAt: now,
      updatedAt: now,
      lastHeartbeatAt: now,
    };

    this.data.lobbies.unshift(lobby);
    this.save();
    return lobby;
  }

  updateLobby(id, patch) {
    const lobby = this.getLobby(id);
    if (!lobby) return null;
    const next = { ...lobby };

    const fields = [
      "title",
      "game",
      "mode",
      "map",
      "playlist",
      "hostName",
      "sessionId",
      "telemetryTimestamp",
      "status",
      "source",
      "lastHeartbeatAt",
      "mapInfo",
      "modeInfo",
      "modDetails",
    ];

    fields.forEach((field) => {
      if (patch[field] !== undefined) {
        next[field] =
          typeof patch[field] === "string"
            ? String(patch[field])
            : patch[field];
      }
    });

    if (patch.maxPlayers !== undefined) {
      next.maxPlayers = Number(patch.maxPlayers);
    }

    if (patch.currentPlayers !== undefined) {
      next.currentPlayers = Number(patch.currentPlayers);
    }

    if (patch.isModded !== undefined) {
      next.isModded = Boolean(patch.isModded);
    }

    if (patch.requiredMods !== undefined) {
      next.requiredMods = normalizeMods(patch.requiredMods || []);
    }

    if (patch.autoPopulated !== undefined) {
      next.autoPopulated = Boolean(patch.autoPopulated);
    }

    if (patch.isPublic !== undefined) {
      next.isPublic = Boolean(patch.isPublic);
    }

    next.updatedAt = new Date().toISOString();

    this.data.lobbies = this.data.lobbies.map((item) =>
      item.id === id ? next : item
    );
    this.save();
    return next;
  }

  heartbeatLobby(id) {
    return this.updateLobby(id, { lastHeartbeatAt: new Date().toISOString() });
  }

  closeLobby(id) {
    return this.updateLobby(id, { status: "closed" });
  }

  deleteLobby(id) {
    const existing = this.getLobby(id);
    if (!existing) return null;
    this.data.lobbies = this.data.lobbies.filter((item) => item.id !== id);
    this.data.requests = this.data.requests.filter(
      (request) => request.lobbyId !== id
    );
    this.save();
    return existing;
  }

  listRequests(lobbyId) {
    if (!lobbyId) return [...this.data.requests];
    return this.data.requests.filter((req) => req.lobbyId === lobbyId);
  }

  addRequest({ lobbyId, playerName }) {
    const lobby = this.getLobby(lobbyId);
    if (!lobby || lobby.status !== "active") return null;
    const request = {
      id: crypto.randomUUID(),
      lobbyId,
      playerName: String(playerName || "Player").trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    this.data.requests.unshift(request);
    this.save();
    return request;
  }

  respondRequest({ requestId, decision }) {
    const request = this.data.requests.find((req) => req.id === requestId);
    if (!request) return null;
    if (request.status !== "pending") return request;

    const nextStatus = decision === "accept" ? "accepted" : "rejected";
    request.status = nextStatus;

    if (nextStatus === "accepted") {
      const lobby = this.getLobby(request.lobbyId);
      if (lobby && lobby.status === "active") {
        lobby.currentPlayers = Math.min(
          Number(lobby.maxPlayers || 16),
          Number(lobby.currentPlayers || 0) + 1
        );
        lobby.updatedAt = new Date().toISOString();
      }
    }

    this.save();
    return request;
  }

  setInstalledMods(mods) {
    this.data.installedMods = normalizeMods(mods);
    this.save();
    return this.data.installedMods;
  }

  getInstalledMods() {
    return [...this.data.installedMods];
  }

  validateMods(requiredMods) {
    const required = normalizeMods(requiredMods);
    const installed = new Set(this.data.installedMods);
    const missing = required.filter((mod) => !installed.has(mod));
    return {
      isValid: missing.length === 0,
      missing,
    };
  }
}

module.exports = { LobbyStore };
