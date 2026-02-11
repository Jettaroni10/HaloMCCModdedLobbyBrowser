const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SCHEMA_VERSION,
  validatePayload,
} = require("./telemetryContract");

const DEFAULT_CUSTOMS_STATE = {
  version: DEFAULT_SCHEMA_VERSION,
  data: {
    isCustomGame: false,
    mapName: "",
    gameMode: "",
    playlist: "",
    playerCount: 0,
    maxPlayers: 0,
    hostName: "",
    mods: [],
    isModded: false,
    sessionID: "",
    timestamp: null,
    seq: 0,
    mapUpdatedThisTick: null,
    modeUpdatedThisTick: null,
    playersUpdatedThisTick: null,
  },
};

function safeLog(logger, level, message) {
  if (!logger) return;
  if (typeof logger[level] === "function") {
    logger[level](message);
    return;
  }
  if (typeof logger.log === "function") {
    logger.log(message);
  }
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_CUSTOMS_STATE));
}

function normalizeMods(mods) {
  if (!Array.isArray(mods)) return [];
  return mods
    .map((mod) => String(mod || "").trim())
    .filter(Boolean);
}

function normalizeUpdatedFlag(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function normalizeEnvelope(raw) {
  const isEnvelope =
    raw && typeof raw === "object" && raw.data && typeof raw.data === "object";
  const base = isEnvelope ? { ...raw } : {};
  const payload = isEnvelope ? raw.data : raw;
  const defaults = DEFAULT_CUSTOMS_STATE.data;
  const nextPayload = {
    ...defaults,
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  let changed = !isEnvelope;

  if (typeof nextPayload.isCustomGame !== "boolean") {
    nextPayload.isCustomGame = false;
    changed = true;
  }
  if (typeof nextPayload.mapName !== "string") {
    nextPayload.mapName = "";
    changed = true;
  }
  if (typeof nextPayload.gameMode !== "string") {
    nextPayload.gameMode = "";
    changed = true;
  }
  if (typeof nextPayload.playlist !== "string") {
    nextPayload.playlist = "";
    changed = true;
  }
  if (!Number.isFinite(Number(nextPayload.playerCount))) {
    nextPayload.playerCount = 0;
    changed = true;
  } else {
    const value = Number(nextPayload.playerCount);
    if (nextPayload.playerCount !== value) {
      nextPayload.playerCount = value;
      changed = true;
    }
  }
  if (!Number.isFinite(Number(nextPayload.maxPlayers))) {
    nextPayload.maxPlayers = 0;
    changed = true;
  } else {
    const value = Number(nextPayload.maxPlayers);
    if (nextPayload.maxPlayers !== value) {
      nextPayload.maxPlayers = value;
      changed = true;
    }
  }
  if (typeof nextPayload.hostName !== "string") {
    nextPayload.hostName = "";
    changed = true;
  }
  if (!Array.isArray(nextPayload.mods)) {
    nextPayload.mods = [];
    changed = true;
  } else {
    const normalized = normalizeMods(nextPayload.mods);
    if (normalized.length !== nextPayload.mods.length) {
      nextPayload.mods = normalized;
      changed = true;
    }
  }
  if (typeof nextPayload.isModded !== "boolean") {
    nextPayload.isModded = nextPayload.mods.length > 0;
    changed = true;
  }
  if (typeof nextPayload.sessionID !== "string") {
    nextPayload.sessionID = "";
    changed = true;
  }
  if (
    nextPayload.timestamp !== null &&
    nextPayload.timestamp !== undefined &&
    typeof nextPayload.timestamp !== "string"
  ) {
    nextPayload.timestamp = null;
    changed = true;
  }
  if (nextPayload.seq === undefined) {
    nextPayload.seq = 0;
    changed = true;
  } else if (!Number.isFinite(Number(nextPayload.seq))) {
    nextPayload.seq = 0;
    changed = true;
  } else {
    const value = Number(nextPayload.seq);
    if (nextPayload.seq !== value) {
      nextPayload.seq = value;
      changed = true;
    }
  }
  if (
    nextPayload.mapUpdatedThisTick !== null &&
    nextPayload.mapUpdatedThisTick !== true &&
    nextPayload.mapUpdatedThisTick !== false
  ) {
    nextPayload.mapUpdatedThisTick = null;
    changed = true;
  }
  if (
    nextPayload.modeUpdatedThisTick !== null &&
    nextPayload.modeUpdatedThisTick !== true &&
    nextPayload.modeUpdatedThisTick !== false
  ) {
    nextPayload.modeUpdatedThisTick = null;
    changed = true;
  }
  if (
    nextPayload.playersUpdatedThisTick !== null &&
    nextPayload.playersUpdatedThisTick !== true &&
    nextPayload.playersUpdatedThisTick !== false
  ) {
    nextPayload.playersUpdatedThisTick = null;
    changed = true;
  }

  const version = String(
    isEnvelope && raw.version ? raw.version : DEFAULT_SCHEMA_VERSION
  );
  if (base.version !== version) {
    base.version = version;
    changed = true;
  }

  base.data = nextPayload;

  return { envelope: base, changed };
}

function backupInvalidFile(filePath, logger) {
  const backupPath = `${filePath}.bak.${Date.now()}`;
  try {
    fs.renameSync(filePath, backupPath);
    safeLog(logger, "warn", `[telemetry] Backed up invalid JSON to ${backupPath}`);
    return backupPath;
  } catch (error) {
    try {
      fs.copyFileSync(filePath, backupPath);
      safeLog(
        logger,
        "warn",
        `[telemetry] Copied invalid JSON to ${backupPath} (rename failed)`
      );
      return backupPath;
    } catch (copyError) {
      safeLog(
        logger,
        "error",
        `[telemetry] Failed to back up invalid JSON: ${copyError?.message || copyError}`
      );
      return null;
    }
  }
}

function writeEnvelope(filePath, envelope) {
  const payload = envelope || cloneDefault();
  ensureDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function ensureCustomsStateExists({ filePath, logger } = {}) {
  const targetPath = String(filePath || "").trim();
  if (!targetPath) {
    safeLog(logger, "warn", "[telemetry] customs_state path missing.");
    return { ok: false, action: "missing-path" };
  }

  ensureDir(targetPath);

  if (!fs.existsSync(targetPath)) {
    writeEnvelope(targetPath, cloneDefault());
    safeLog(logger, "info", `[telemetry] Created ${targetPath}`);
    return { ok: true, action: "created" };
  }

  let raw = null;
  try {
    raw = fs.readFileSync(targetPath, "utf8");
  } catch (error) {
    safeLog(
      logger,
      "error",
      `[telemetry] Failed to read ${targetPath}: ${error?.message || error}`
    );
    return { ok: false, action: "read-failed" };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const backupPath = backupInvalidFile(targetPath, logger);
    writeEnvelope(targetPath, cloneDefault());
    safeLog(
      logger,
      "warn",
      `[telemetry] Reset invalid JSON at ${targetPath}`
    );
    return { ok: true, action: "reset-invalid-json", backupPath };
  }

  if (!parsed || typeof parsed !== "object") {
    const backupPath = backupInvalidFile(targetPath, logger);
    writeEnvelope(targetPath, cloneDefault());
    safeLog(
      logger,
      "warn",
      `[telemetry] Reset invalid payload at ${targetPath}`
    );
    return { ok: true, action: "reset-invalid-payload", backupPath };
  }

  const { envelope, changed } = normalizeEnvelope(parsed);
  const issues = validatePayload(envelope.data);
  if (issues.length > 0) {
    safeLog(
      logger,
      "warn",
      `[telemetry] Telemetry file has validation issues: ${issues.join(", ")}`
    );
  }

  if (changed) {
    writeEnvelope(targetPath, envelope);
    safeLog(logger, "info", `[telemetry] Patched ${targetPath}`);
    return { ok: true, action: "patched" };
  }

  return { ok: true, action: "exists" };
}

module.exports = {
  DEFAULT_CUSTOMS_STATE,
  ensureCustomsStateExists,
};
