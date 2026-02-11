const path = require("path");
const os = require("os");

const PRODUCT_DIR = "HMCC Overlay";

function getDataRootDir(app) {
  if (app && typeof app.getPath === "function") {
    return app.getPath("userData");
  }
  return path.join(os.homedir(), "AppData", "Roaming", PRODUCT_DIR);
}

function getAppDataDir(app) {
  return getDataRootDir(app);
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
  return path.join(getDataRootDir(app), "customs_state.json");
}

function getConfigPath(app) {
  return path.join(getAppDataDir(app), "halo-mcc-config.json");
}

function getLobbyStorePath(app) {
  return path.join(getAppDataDir(app), "halo-mcc-lobbies.json");
}

module.exports = {
  getDataRootDir,
  getAppDataDir,
  getCacheDir,
  getLogsDir,
  getCustomsStatePath,
  getConfigPath,
  getLobbyStorePath,
};
