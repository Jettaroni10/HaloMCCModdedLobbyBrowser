const fs = require("fs");
const path = require("path");
const {
  DEFAULT_SCHEMA_VERSION,
  parseTelemetryDocument,
  normalizeState,
} = require("./telemetryContract");

const DEFAULT_STALE_MS = 15000;

class FileGameStateProvider {
  constructor({ filePath, staleAfterMs = DEFAULT_STALE_MS } = {}) {
    this.filePath = filePath || "";
    this.staleAfterMs = staleAfterMs;
    this.state = normalizeState(null);
    this.lastUpdatedAt = null;
    this.lastError = null;
    this.lastValidationIssues = [];
    this.schemaVersion = DEFAULT_SCHEMA_VERSION;
    this.fileWatcher = null;
    this.dirWatcher = null;
    this.pollTimer = null;
  }

  start() {
    if (!this.filePath) return;
    if (this.pollTimer) return;
    this.readFile();
    this.watchDirectory();
    this.watchFile();
    this.pollTimer = setInterval(() => this.readFile(), 1000);
  }

  stop() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.dirWatcher) {
      this.dirWatcher.close();
      this.dirWatcher = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  setFilePath(filePath) {
    this.filePath = filePath || "";
    this.stop();
    this.start();
  }

  watchFile() {
    if (!this.filePath) return;
    if (!fs.existsSync(this.filePath)) return;
    try {
      this.fileWatcher = fs.watch(this.filePath, { persistent: false }, () => {
        this.readFile();
      });
    } catch (error) {
      this.lastError = error?.message || String(error);
    }
  }

  watchDirectory() {
    if (!this.filePath) return;
    const dirPath = path.dirname(this.filePath);
    try {
      this.dirWatcher = fs.watch(dirPath, { persistent: false }, () => {
        this.readFile();
        if (!this.fileWatcher && fs.existsSync(this.filePath)) {
          this.watchFile();
        }
      });
    } catch {
      // optional watcher, ignore if missing path
    }
  }

  readFile() {
    if (!this.filePath) return;
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      const telemetry = parseTelemetryDocument(parsed);
      this.schemaVersion = telemetry.version || DEFAULT_SCHEMA_VERSION;
      this.lastValidationIssues = telemetry.validationIssues;
      this.state = telemetry.normalizedState;
      this.lastUpdatedAt = new Date().toISOString();
      this.lastError = null;
    } catch (error) {
      this.lastError = error?.message || String(error);
    }
  }

  getState() {
    const now = Date.now();
    const last = this.lastUpdatedAt ? Date.parse(this.lastUpdatedAt) : 0;
    const stale = last > 0 ? now - last > this.staleAfterMs : true;
    if (stale) {
      return { ...this.state, isCustomGame: false };
    }
    return { ...this.state };
  }

  getStatus() {
    const exists = this.filePath ? fs.existsSync(this.filePath) : false;
    const last = this.lastUpdatedAt;
    const now = Date.now();
    const lastMs = last ? Date.parse(last) : 0;
    const stale = lastMs > 0 ? now - lastMs > this.staleAfterMs : true;
    return {
      provider: "telemetry",
      filePath: this.filePath,
      exists,
      lastUpdatedAt: last,
      stale,
      error: this.lastError,
      schemaVersion: this.schemaVersion,
      validationIssues: [...this.lastValidationIssues],
    };
  }
}

module.exports = { FileGameStateProvider };
