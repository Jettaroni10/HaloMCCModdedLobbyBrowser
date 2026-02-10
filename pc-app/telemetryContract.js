const DEFAULT_SCHEMA_VERSION = "1.0";

function normalizeMods(mods) {
  if (!Array.isArray(mods)) return [];
  return Array.from(
    new Set(mods.map((mod) => String(mod || "").trim()).filter(Boolean))
  );
}

function unwrapEnvelope(raw) {
  if (!raw || typeof raw !== "object") {
    return { version: DEFAULT_SCHEMA_VERSION, payload: null };
  }
  if ("data" in raw && raw.data && typeof raw.data === "object") {
    return {
      version: String(raw.version || DEFAULT_SCHEMA_VERSION),
      payload: raw.data,
    };
  }
  return {
    version: DEFAULT_SCHEMA_VERSION,
    payload: raw,
  };
}

function validatePayload(payload) {
  const issues = [];
  if (!payload || typeof payload !== "object") {
    issues.push("Payload missing.");
    return issues;
  }

  if (typeof payload.isCustomGame !== "boolean") {
    issues.push("isCustomGame must be a boolean.");
  }

  if (payload.isCustomGame === true) {
    if (!payload.mapName && !payload.map) issues.push("Missing map name.");
    if (!payload.gameMode && !payload.mode) issues.push("Missing game mode.");
  }

  const playerCount = Number(
    payload.playerCount ?? payload.players ?? payload.currentPlayers ?? 0
  );
  const maxPlayers = Number(payload.maxPlayers ?? 0);

  if (Number.isNaN(playerCount) || playerCount < 0 || playerCount > 32) {
    issues.push("playerCount out of range (0-32).");
  }

  if (Number.isNaN(maxPlayers) || maxPlayers < 0 || maxPlayers > 32) {
    issues.push("maxPlayers out of range (0-32).");
  }

  if (maxPlayers > 0 && playerCount > maxPlayers) {
    issues.push("playerCount exceeds maxPlayers.");
  }

  if (payload.mods !== undefined && !Array.isArray(payload.mods)) {
    issues.push("mods must be an array.");
  }

  return issues;
}

function normalizeState(payload, version) {
  if (!payload || typeof payload !== "object") {
    return {
      isCustomGame: false,
      title: "",
      game: "MCC",
      mode: "",
      map: "",
      playlist: "",
      hostName: "",
      currentPlayers: 0,
      maxPlayers: 0,
      isModded: false,
      requiredMods: [],
      sessionId: "",
      timestamp: null,
      schemaVersion: version || DEFAULT_SCHEMA_VERSION,
    };
  }

  const map = payload.mapName || payload.map || "";
  const mode = payload.gameMode || payload.mode || "";
  const playlist = payload.playlist || "";
  const requiredMods = normalizeMods(
    payload.mods || payload.modList || payload.mapMods || []
  );
  const isModded =
    typeof payload.isModded === "boolean"
      ? payload.isModded
      : requiredMods.length > 0;

  return {
    isCustomGame: Boolean(payload.isCustomGame),
    title: payload.title || (map && mode ? `${map} - ${mode}` : ""),
    game: payload.game || "MCC",
    mode,
    map,
    playlist,
    hostName: payload.hostName || payload.host || "",
    currentPlayers: Number(
      payload.playerCount ?? payload.players ?? payload.currentPlayers ?? 0
    ),
    maxPlayers: Number(payload.maxPlayers || 0),
    isModded,
    requiredMods,
    sessionId: String(payload.sessionID || payload.sessionId || "").trim(),
    timestamp: payload.timestamp || null,
    schemaVersion: version || DEFAULT_SCHEMA_VERSION,
    seq: Number.isFinite(Number(payload.seq)) ? Number(payload.seq) : 0,
    debug: payload.debug && typeof payload.debug === "object" ? payload.debug : null,
  };
}

function parseTelemetryDocument(raw) {
  const { version, payload } = unwrapEnvelope(raw);
  const validationIssues = validatePayload(payload);
  const normalizedState = normalizeState(payload, version);
  return {
    version,
    payload,
    validationIssues,
    normalizedState,
  };
}

function toCanonicalEnvelope(raw) {
  const { version, payload } = unwrapEnvelope(raw);
  return {
    version: version || DEFAULT_SCHEMA_VERSION,
    data: payload || { isCustomGame: false },
  };
}

module.exports = {
  DEFAULT_SCHEMA_VERSION,
  normalizeMods,
  unwrapEnvelope,
  validatePayload,
  normalizeState,
  parseTelemetryDocument,
  toCanonicalEnvelope,
};
