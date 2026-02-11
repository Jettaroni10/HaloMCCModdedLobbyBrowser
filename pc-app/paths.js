const path = require("path");
const os = require("os");

const PRODUCT_DIR = "HMCC Overlay";

function getAppDataRoot(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("appData");
  }
  if (process.env.APPDATA) return process.env.APPDATA;
  return path.join(os.homedir(), "AppData", "Roaming");
}

function getAppDataDir(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("userData");
  }
  return path.join(getAppDataRoot(app), PRODUCT_DIR);
}

function getCacheDir(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("cache");
  }
  const localRoot =
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  return path.join(localRoot, PRODUCT_DIR, "Cache");
}

function getLogsDir(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("logs");
  }
  return path.join(getAppDataDir(app), "logs");
}

function getCustomsStatePath(app) {
  return path.join(getAppDataRoot(app), "MCC", "customs_state.json");
}

function getConfigPath(app) {
  return path.join(getAppDataDir(app), "halo-mcc-config.json");
}

function getLobbyStorePath(app) {
  return path.join(getAppDataDir(app), "halo-mcc-lobbies.json");
}

module.exports = {
  getAppDataDir,
  getCacheDir,
  getLogsDir,
  getCustomsStatePath,
  getConfigPath,
  getLobbyStorePath,
};
