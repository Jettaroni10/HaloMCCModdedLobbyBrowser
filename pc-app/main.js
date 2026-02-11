const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  screen,
  globalShortcut,
  Menu,
} = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const { LobbyStore } = require("./store");
const { GameSessionMonitor, SimulatedGameStateProvider } = require("./monitor");
const { AutoLobbyPopulator } = require("./populator");
const { scanDefaultModPaths } = require("./modScanner");
const { FileGameStateProvider } = require("./telemetryProvider");
const { readConfig, writeConfig } = require("./config");
const { ensureCustomsStateExists } = require("./customsState");
const {
  getDataRootDir,
  getAppDataDir,
  getCustomsStatePath,
  getConfigPath,
  getLobbyStorePath,
} = require("./paths");

let overlayWindow = null;
let store = null;
let monitor = null;
let provider = null;
let populator = null;
let configPath = null;
let config = {};
let telemetryPath = "";
let useTelemetry = false;
let overlaySettings = null;
let readerProcess = null;
let latestTelemetryState = null;
let telemetrySeq = 0;
let lastTelemetryEmitAt = 0;
let telemetryEmitTimer = null;
let miniToggleWindow = null;
let overlayManuallyHidden = false;
let mccWatchTimer = null;
let mccWatchInFlight = false;
let mccMissingCount = 0;
let mccSeen = false;
let mccRunning = null;
let shutdownRequested = false;

const OVERLAY_URL = String(
  process.env.HMCC_OVERLAY_URL || "https://halomoddedcustoms.com"
).trim();
const OVERLAY_FADE_MS = 200;
const OVERLAY_VISIBLE_OPACITY = 1.0;
const OVERLAY_TRANSPARENT = false;
const OVERLAY_BG_COLOR = "#070c12";
const ACTIVE_WIN_POLL_MS = 140;
const MCC_WATCH_INTERVAL_MS = 2000;
const MCC_MISSING_THRESHOLD = 3;
const DEBUG_OVERLAY = String(process.env.HMCC_OVERLAY_DEBUG || "") === "1";
let overlayVisible = false;
let overlayEnabled = true;
let overlayReady = false;
let mccFocused = false;
let overlayFocused = false;
let fadeTimer = null;
let overlayRefocusTimer = null;
let suppressOverlayRefocus = false;
let focusPollTimer = null;
let focusPollInFlight = false;
let activeWinGetter = null;
let lastActiveSignature = "";
let lastDebugSnapshot = "";
let updaterInitialized = false;
let updaterStatus = "Idle";
let autoUpdater = null;
let updateState = {
  status: "idle",
  version: null,
  releaseNotes: null,
  progress: null,
};
let updateDownloadPromise = null;
let updateInProgress = false;
let debugPanelPinned = false;
let hideOverlayCssKey = null;
let debugPanelModeActive = false;
let overlayFullBounds = null;

const DEBUG_PANEL_SIZE = { width: 360, height: 260 };
const DEBUG_PANEL_INSET = 12;

function getAppIconPath() {
  const candidates = [
    path.join(__dirname, "assets", "icon.ico"),
    path.join(process.resourcesPath || "", "assets", "icon.ico"),
    path.join(process.resourcesPath || "", "app.asar", "assets", "icon.ico"),
  ];
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return null;
}

function ensureAutoUpdaterLoaded() {
  if (autoUpdater) return true;
  try {
    // Lazy-load: electron-updater can throw in dev depending on runtime context.
    autoUpdater = require("electron-updater").autoUpdater;
    return Boolean(autoUpdater);
  } catch (error) {
    const message = error?.message || String(error);
    setUpdaterStatus(`Error: ${message}`);
    if (DEBUG_OVERLAY) {
      console.warn("Failed to load electron-updater:", message);
    }
    autoUpdater = null;
    return false;
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
  process.exit(0);
} else {
  app.on("second-instance", () => {
    // Do not steal focus; just ignore extra launches.
  });
}

const DEFAULT_OVERLAY_SETTINGS = {
  bounds: { width: 1200, height: 820, x: null, y: null },
  opacity: 0.9,
  compact: false,
  clickThrough: false,
  pinned: true,
};

function resolveTelemetryPath(inputPath) {
  const raw = String(inputPath || "").trim();
  if (!raw) return raw;
  return raw.replace(/%([^%]+)%/g, (_match, name) => {
    const value = process.env[name];
    return typeof value === "string" ? value : `%${name}%`;
  });
}

function debugLog(message) {
  if (!DEBUG_OVERLAY) return;
  console.log(`[overlay] ${message}`);
}

function debugSnapshot() {
  if (!DEBUG_OVERLAY) return "";
  return `enabled=${overlayEnabled} debugPinned=${debugPanelPinned} mccFocused=${mccFocused} overlayFocused=${overlayFocused} shouldShow=${
    (overlayEnabled || debugPanelPinned) && (mccFocused || overlayFocused)
  }`;
}

function debugActiveWindow(win) {
  if (!DEBUG_OVERLAY) return;
  const ownerName = String(win?.owner?.name || "");
  const title = String(win?.title || "");
  const pid = win?.owner?.processId ?? win?.owner?.pid ?? win?.pid ?? "";
  const signature = `${ownerName}|${title}|${pid}`;
  const snapshot = debugSnapshot();
  if (signature !== lastActiveSignature || snapshot !== lastDebugSnapshot) {
    lastActiveSignature = signature;
    lastDebugSnapshot = snapshot;
    console.log(
      `[overlay] active=${ownerName || "?"} pid=${pid || "?"} title="${
        title || ""
      }" ${snapshot}`
    );
  } else {
    console.log(
      `[overlay] active=${ownerName || "?"} pid=${pid || "?"} title="${
        title || ""
      }" ${snapshot}`
    );
  }
}

function stopFade() {
  if (fadeTimer) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

function animateOpacity(targetOpacity, durationMs, onComplete) {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  stopFade();
  const startOpacity = overlayWindow.getOpacity();
  const startTime = Date.now();

  fadeTimer = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) {
      stopFade();
      return;
    }
    const elapsed = Date.now() - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const eased =
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const next = startOpacity + (targetOpacity - startOpacity) * eased;
    overlayWindow.setOpacity(next);
    if (t >= 1) {
      stopFade();
      overlayWindow.setOpacity(targetOpacity);
      if (onComplete) onComplete();
    }
  }, 16);
}

function getMiniToggleBounds() {
  const display = screen.getPrimaryDisplay();
  const work = display.workArea;
  const size = 44;
  const inset = 16;
  return {
    x: work.x + work.width - size - inset,
    y: work.y + work.height - size - inset,
    width: size,
    height: size,
  };
}

function createMiniToggleWindow() {
  if (miniToggleWindow && !miniToggleWindow.isDestroyed()) {
    return miniToggleWindow;
  }
  const bounds = getMiniToggleBounds();
  miniToggleWindow = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    fullscreen: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  miniToggleWindow.setAlwaysOnTop(true, "screen-saver");
  miniToggleWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  miniToggleWindow.on("closed", () => {
    miniToggleWindow = null;
  });

  miniToggleWindow.loadFile(path.join(__dirname, "renderer", "mini-toggle.html")).catch(() => {});
  return miniToggleWindow;
}

function showMiniToggleWindow() {
  const win = createMiniToggleWindow();
  if (!win || win.isDestroyed()) return;
  if (!win.isVisible()) {
    win.showInactive();
  }
}

function hideMiniToggleWindow() {
  if (!miniToggleWindow || miniToggleWindow.isDestroyed()) return;
  miniToggleWindow.hide();
}

function shouldRefocusOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return false;
  if (!overlayVisible || overlayManuallyHidden) return false;
  if (overlaySettings?.clickThrough) return false;
  if (suppressOverlayRefocus) return false;
  return true;
}

function scheduleOverlayRefocus(reason) {
  if (!shouldRefocusOverlay()) return;
  if (overlayRefocusTimer) return;
  overlayRefocusTimer = setTimeout(() => {
    overlayRefocusTimer = null;
    if (!shouldRefocusOverlay()) return;
    try {
      overlayWindow.focus();
    } catch (error) {
      if (DEBUG_OVERLAY) {
        debugLog(`overlay refocus failed (${reason}): ${error?.message || error}`);
      }
    }
  }, 80);
}

async function withOverlayFocusRestore(action, reason) {
  const shouldRestore = overlayVisible && !overlayManuallyHidden;
  suppressOverlayRefocus = true;
  try {
    return await action();
  } finally {
    suppressOverlayRefocus = false;
    if (shouldRestore) {
      showOverlay(reason || "restore");
    }
  }
}

function showOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  hideMiniToggleWindow();
  overlayWindow.setSkipTaskbar(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.show();
  applyOverlayEffects();
  overlayWindow.setOpacity(0);
  animateOpacity(OVERLAY_VISIBLE_OPACITY, OVERLAY_FADE_MS);
  if (!overlaySettings?.clickThrough) {
    overlayWindow.focus();
  }
  overlayVisible = true;
}

function hideOverlay() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  animateOpacity(0, OVERLAY_FADE_MS, () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow.hide();
    overlayVisible = false;
  });
}

function recomputeOverlayVisibility(reason) {
  if (!overlayWindow || overlayWindow.isDestroyed() || !overlayReady) return;
  if (overlayManuallyHidden) {
    if (overlayVisible) {
      debugLog(`manual hide overlay (${reason})`);
      hideOverlay();
    }
    showMiniToggleWindow();
    return;
  }
  hideMiniToggleWindow();
  const shouldShow = overlayEnabled || debugPanelPinned || overlayVisible;

  if (shouldShow && !overlayVisible) {
    debugLog(`show overlay (${reason})`);
    showOverlay();
  }

  if (!shouldShow && overlayVisible) {
    debugLog(`hide overlay (${reason})`);
    hideOverlay();
  }
}

function updateOverlayContentMode() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const wc = overlayWindow.webContents;
  if (!wc || wc.isDestroyed()) return;

  const shouldHideMain =
    Boolean(debugPanelPinned) && !overlayEnabled && (mccFocused || overlayFocused);

  if (shouldHideMain) {
    if (hideOverlayCssKey) return;
    const css = `
      /* Hide all site UI except the diagnostics panel + notifications drawer. */
      body * { visibility: hidden !important; }
      #hmcc-overlay-diagnostics,
      #hmcc-overlay-diagnostics *,
      #hmcc-notifications-drawer,
      #hmcc-notifications-drawer * { visibility: visible !important; }
    `;
    wc.insertCSS(css).then((key) => {
      hideOverlayCssKey = key;
    }).catch(() => {});

    // Shrink the window to the debug panel so we don't leave a full-screen solid background.
    if (!debugPanelModeActive) {
      try {
        if (!overlayFullBounds) {
          overlayFullBounds = overlayWindow.getBounds();
        }
        const primary = screen.getPrimaryDisplay();
        const work = primary.workArea;
        overlayWindow.setBounds(
          {
            x: work.x + DEBUG_PANEL_INSET,
            y: work.y + work.height - DEBUG_PANEL_SIZE.height - DEBUG_PANEL_INSET,
            width: DEBUG_PANEL_SIZE.width,
            height: DEBUG_PANEL_SIZE.height,
          },
          false
        );
        debugPanelModeActive = true;
      } catch {
        // best-effort
      }
    }
    return;
  }

  if (hideOverlayCssKey) {
    const key = hideOverlayCssKey;
    hideOverlayCssKey = null;
    wc.removeInsertedCSS(key).catch(() => {});
  }

  // Restore full-screen bounds when leaving debug-only mode.
  if (debugPanelModeActive) {
    try {
      const next = overlayFullBounds || getFullscreenBounds();
      overlayWindow.setBounds(next, false);
    } catch {
      // best-effort
    } finally {
      debugPanelModeActive = false;
    }
  }
}

function setMccFocused(nextValue, reason) {
  if (mccFocused === nextValue) return;
  mccFocused = nextValue;
  debugLog(`MCC focused: ${mccFocused ? "yes" : "no"}`);
  recomputeOverlayVisibility(reason);
  updateOverlayContentMode();
}

function setOverlayFocused(nextValue, reason) {
  if (overlayFocused === nextValue) return;
  overlayFocused = nextValue;
  debugLog(`Overlay focused: ${overlayFocused ? "yes" : "no"}`);
  recomputeOverlayVisibility(reason);
  updateOverlayContentMode();
}

function toggleOverlayEnabled() {
  overlayEnabled = !overlayEnabled;
  debugLog(`overlay enabled: ${overlayEnabled ? "on" : "off"}`);
  recomputeOverlayVisibility("toggle");
  updateOverlayContentMode();
}

function setOverlayManualHidden(nextValue, reason) {
  if (overlayManuallyHidden === nextValue) return;
  overlayManuallyHidden = nextValue;
  debugLog(`overlay manual hidden: ${overlayManuallyHidden ? "yes" : "no"}`);
  recomputeOverlayVisibility(reason || "manual");
}

function toggleOverlayVisibility(reason) {
  if (overlayVisible) {
    setOverlayManualHidden(true, reason || "toggle-hide");
    return;
  }
  setOverlayManualHidden(false, reason || "toggle-show");
  showOverlay();
}

function notifyRendererShutdown(reason) {
  if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.webContents) {
    overlayWindow.webContents.send("hmcc:shutdown", { reason });
  }
}

function requestOverlayShutdown(reason) {
  if (shutdownRequested) return;
  shutdownRequested = true;
  notifyRendererShutdown(reason);
  setTimeout(() => {
    try {
      app.quit();
    } catch {
      // ignore
    }
  }, 1500);
}

async function loadActiveWinGetter() {
  if (activeWinGetter) return activeWinGetter;
  try {
    const mod = await import("active-win");
    activeWinGetter = mod.activeWindow || mod.default;
    if (typeof activeWinGetter !== "function") {
      throw new Error("active-win export missing");
    }
  } catch (error) {
    console.warn("Failed to load active-win:", error?.message || String(error));
    activeWinGetter = null;
  }
  return activeWinGetter;
}

function isMccFocusedWindow(win) {
  if (!win) return false;
  const title = String(win.title || "").toLowerCase();
  const ownerName = String(win.owner?.name || "").toLowerCase();
  return (
    ownerName === "mcc-win64-shipping.exe" ||
    ownerName === "mcc-win64-shipping" ||
    title.includes("halo: the master chief collection")
  );
}

function isOverlayActiveWindow(win) {
  if (!win) return false;
  const title = String(win.title || "").toLowerCase();
  const ownerName = String(win.owner?.name || "").toLowerCase();
  const ownerPid = Number(win.owner?.processId ?? win.owner?.pid ?? 0);
  return (
    ownerPid === process.pid ||
    (ownerName.includes("electron") && title.includes("customs on the ring"))
  );
}

function startFocusWatcher() {
  if (focusPollTimer) return;
  focusPollTimer = setInterval(async () => {
    if (focusPollInFlight) return;
    focusPollInFlight = true;
    try {
      const getter = await loadActiveWinGetter();
      if (!getter) {
        debugLog("active-win getter unavailable");
        debugActiveWindow(null);
        return;
      }
      const win = await getter();
      if (!win) {
        debugLog("active-win returned null");
      }
      debugActiveWindow(win);
      setMccFocused(isMccFocusedWindow(win), "focus");
      const windowFocus =
        Boolean(overlayWindow) &&
        !overlayWindow.isDestroyed() &&
        overlayWindow.isFocused();
      setOverlayFocused(isOverlayActiveWindow(win) || windowFocus, "focus");
    } catch (error) {
      if (DEBUG_OVERLAY) {
        console.warn("Active window polling failed:", error?.message || error);
      }
    } finally {
      focusPollInFlight = false;
    }
  }, ACTIVE_WIN_POLL_MS);
}

function stopFocusWatcher() {
  if (focusPollTimer) {
    clearInterval(focusPollTimer);
    focusPollTimer = null;
  }
}

function isMccProcessRunning() {
  if (process.platform !== "win32") {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    exec(
      'tasklist /FI "IMAGENAME eq MCC-Win64-Shipping.exe"',
      { windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(true);
          return;
        }
        resolve(/MCC-Win64-Shipping\.exe/i.test(stdout || ""));
      }
    );
  });
}

function startMccWatcher() {
  if (mccWatchTimer) return;
  mccWatchTimer = setInterval(async () => {
    if (mccWatchInFlight) return;
    mccWatchInFlight = true;
    try {
      const running = await isMccProcessRunning();
      mccRunning = Boolean(running);
      if (running) {
        if (!mccSeen) {
          debugLog("MCC detected; watcher armed.");
        }
        mccSeen = true;
        mccMissingCount = 0;
        return;
      }
      if (!mccSeen) {
        return;
      }
      mccMissingCount += 1;
      if (mccMissingCount >= MCC_MISSING_THRESHOLD) {
        if (updateInProgress) {
          return;
        }
        debugLog("MCC closed; shutting down overlay.");
        requestOverlayShutdown("mcc-closed");
      }
    } catch (error) {
      if (DEBUG_OVERLAY) {
        console.warn("MCC watcher failed:", error?.message || error);
      }
    } finally {
      mccWatchInFlight = false;
    }
  }, MCC_WATCH_INTERVAL_MS);
}

function stopMccWatcher() {
  if (mccWatchTimer) {
    clearInterval(mccWatchTimer);
    mccWatchTimer = null;
  }
}

function setUpdaterStatus(statusText) {
  updaterStatus = String(statusText || "Idle");
  debugLog(`Updater status: ${updaterStatus}`);
  buildApplicationMenu();
}

function normalizeReleaseNotes(notes) {
  if (!notes) return null;
  if (typeof notes === "string") return notes;
  if (Array.isArray(notes)) {
    const first = notes.find((entry) => typeof entry === "string");
    if (first) return first;
    const objectNote = notes.find((entry) => typeof entry?.note === "string");
    return objectNote?.note || null;
  }
  if (typeof notes.note === "string") return notes.note;
  return null;
}

async function triggerUpdateCheck(manual = false) {
  if (!app.isPackaged) {
    setUpdaterStatus("Disabled in development");
    if (manual) {
      await dialog.showMessageBox({
        type: "info",
        title: "Updates",
        message: "Auto-updater is only enabled in packaged builds.",
      });
    }
    return;
  }
  if (!ensureAutoUpdaterLoaded()) {
    if (manual) {
      await dialog.showMessageBox({
        type: "error",
        title: "Updates",
        message: "Auto-updater failed to initialize. Check logs for details.",
      });
    }
    return;
  }
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error?.message || String(error);
    setUpdaterStatus(`Error: ${message}`);
    if (manual) {
      await dialog.showMessageBox({
        type: "error",
        title: "Update Check Failed",
        message,
      });
    }
  }
}

function buildApplicationMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "HMCC Overlay",
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: `Updates: ${updaterStatus}`, enabled: false },
        { type: "separator" },
        {
          label: "Check for updates",
          click: () => {
            triggerUpdateCheck(true);
          },
        },
        { type: "separator" },
        { role: "quit", label: "Quit" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

function initAutoUpdater() {
  if (updaterInitialized) return;
  updaterInitialized = true;
  if (!app.isPackaged) {
    setUpdaterStatus("Disabled in development");
    return;
  }
  if (!ensureAutoUpdaterLoaded()) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    setUpdaterStatus("Checking for updates...");
    updateState = { status: "checking", version: null, releaseNotes: null, progress: null };
  });
  autoUpdater.on("update-available", (info) => {
    setUpdaterStatus(`Update available (${info?.version || "new version"})`);
    updateState = {
      status: "update-available",
      version: info?.version || null,
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
      progress: null,
    };
  });
  autoUpdater.on("update-not-available", () => {
    setUpdaterStatus("Up to date");
    updateState = { status: "no-update", version: app.getVersion(), releaseNotes: null, progress: null };
  });
  autoUpdater.on("error", (error) => {
    setUpdaterStatus(`Error: ${error?.message || String(error)}`);
    updateState = { status: "error", version: null, releaseNotes: null, progress: null };
    updateInProgress = false;
  });
  autoUpdater.on("download-progress", (progress) => {
    const percent = Number.isFinite(progress?.percent)
      ? Math.round(progress.percent)
      : 0;
    setUpdaterStatus(`Downloading update... ${percent}%`);
    updateState = {
      status: "downloading",
      version: updateState.version,
      releaseNotes: updateState.releaseNotes,
      progress: percent,
    };
  });
  autoUpdater.on("update-downloaded", (info) => {
    setUpdaterStatus(`Update downloaded (${info?.version || "new version"})`);
    updateState = {
      status: "downloaded",
      version: info?.version || null,
      releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
      progress: 100,
    };
  });

  setUpdaterStatus("Checking for updates...");
  triggerUpdateCheck(false);
}

function saveConfig() {
  if (!configPath) return;
  writeConfig(configPath, {
    telemetryFilePath: telemetryPath,
    useTelemetry,
    overlay: overlaySettings,
  });
}

function loadOverlaySettings() {
  const stored = config && typeof config.overlay === "object" ? config.overlay : {};
  const bounds = stored.bounds && typeof stored.bounds === "object" ? stored.bounds : {};
  const rawOpacity = Number(stored.opacity);
  const clampedOpacity = Number.isFinite(rawOpacity)
    ? Math.max(0.4, Math.min(1, rawOpacity))
    : DEFAULT_OVERLAY_SETTINGS.opacity;
  overlaySettings = {
    ...DEFAULT_OVERLAY_SETTINGS,
    ...stored,
    bounds: {
      ...DEFAULT_OVERLAY_SETTINGS.bounds,
      ...bounds,
    },
    opacity: clampedOpacity,
  };
  return overlaySettings;
}

function setProvider(nextProvider, nextType) {
  if (provider && provider.stop) provider.stop();
  provider = nextProvider;
  if (nextType) {
    useTelemetry = nextType === "telemetry";
  }
  monitor.setProvider(provider);
  if (provider && provider.start) provider.start();
  emitTelemetryUpdate();
}

function getTelemetryStatus() {
  const base = provider?.getStatus ? provider.getStatus() : null;
  return {
    provider: useTelemetry ? "telemetry" : "simulated",
    filePath: telemetryPath,
    expectedSchemaVersion: "1.0",
    ...(base || {}),
  };
}

function emitTelemetryUpdate() {
  const payload = buildTelemetryState();
  telemetrySeq += 1;
  lastTelemetryEmitAt = Date.now();
  payload.seq = telemetrySeq;
  payload.emittedAt = new Date().toISOString();
  latestTelemetryState = payload;
  if (
    overlayWindow &&
    !overlayWindow.isDestroyed() &&
    overlayWindow.webContents &&
    !overlayWindow.webContents.isDestroyed()
  ) {
    overlayWindow.webContents.send("hmcc:telemetry", payload);
  }
}

function startTelemetryEmitter() {
  if (telemetryEmitTimer) return;
  telemetryEmitTimer = setInterval(() => emitTelemetryUpdate(), 500);
}

function stopTelemetryEmitter() {
  if (!telemetryEmitTimer) return;
  clearInterval(telemetryEmitTimer);
  telemetryEmitTimer = null;
}

function loadOverlayContent() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const attemptLoad = () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    overlayWindow
      .loadURL(OVERLAY_URL)
      .catch(() => setTimeout(attemptLoad, 700));
  };
  attemptLoad();
}

function resolveReaderPath() {
  if (process.env.MCC_READER_EXE) {
    return process.env.MCC_READER_EXE;
  }
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "bin", "mcc_player_overlay.exe");
  }
  return path.resolve(
    __dirname,
    "..",
    "mcc-telemetry-mod-stub",
    "build",
    "Release",
    "mcc_player_overlay.exe"
  );
}

function startReaderProcess() {
  if (readerProcess) return;
  const readerPath = resolveReaderPath();
  console.info(
    `[reader] launch context: app.isPackaged=${app.isPackaged} resourcesPath=${process.resourcesPath} readerPath=${readerPath}`
  );
  if (!fs.existsSync(readerPath)) {
    const expectedPackagedPath = path.join(
      process.resourcesPath,
      "bin",
      "mcc_player_overlay.exe"
    );
    console.error(`Reader exe not found: ${readerPath}`);
    console.error(`Packaged reader path: ${expectedPackagedPath}`);
    console.error(
      `Installer packaging misconfigured: expected reader at ${expectedPackagedPath}`
    );
    console.error(
      "Build mcc-telemetry-mod-stub first so electron-builder can bundle mcc_player_overlay.exe."
    );
    return;
  }
  let readerStdout = "";
  let readerStderr = "";
  readerProcess = spawn(readerPath, [], {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      MCC_TELEMETRY_OUT: telemetryPath,
    },
  });
  if (readerProcess.stdout) {
    readerProcess.stdout.on("data", (chunk) => {
      readerStdout += chunk.toString();
    });
  }
  if (readerProcess.stderr) {
    readerProcess.stderr.on("data", (chunk) => {
      readerStderr += chunk.toString();
    });
  }
  readerProcess.on("exit", (code, signal) => {
    if (code !== 0) {
      console.error(
        `[reader] exited unexpectedly: code=${code} signal=${signal || "none"}`
      );
      if (readerStdout.trim()) {
        console.error(`[reader] stdout: ${readerStdout.trim()}`);
      }
      if (readerStderr.trim()) {
        console.error(`[reader] stderr: ${readerStderr.trim()}`);
      }
    }
    readerProcess = null;
  });
  readerProcess.on("error", (error) => {
    console.warn("Reader failed to start:", error?.message || String(error));
    if (readerStdout.trim()) {
      console.error(`[reader] stdout: ${readerStdout.trim()}`);
    }
    if (readerStderr.trim()) {
      console.error(`[reader] stderr: ${readerStderr.trim()}`);
    }
    readerProcess = null;
  });
}

function stopReaderProcess() {
  if (!readerProcess) return;
  readerProcess.kill();
  readerProcess = null;
}

function getFullscreenBounds() {
  const display = screen.getPrimaryDisplay();
  return display.bounds;
}

function applyOverlayEffects() {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  if (!OVERLAY_TRANSPARENT) {
    debugLog("Skipping acrylic (overlay not transparent)");
    return;
  }
  if (process.platform === "win32") {
    if (typeof overlayWindow.setBackgroundMaterial === "function") {
      try {
        overlayWindow.setBackgroundMaterial("acrylic");
        debugLog("Applying acrylic... success");
      } catch (error) {
        debugLog(
          `Applying acrylic... failed (${error?.message || String(error)})`
        );
        try {
          overlayWindow.setBackgroundMaterial("mica");
          debugLog("Applying mica... success");
        } catch (fallbackError) {
          debugLog(
            `Applying mica... failed (${fallbackError?.message || String(
              fallbackError
            )})`
          );
        }
      }
    } else {
      debugLog("Applying acrylic... skipped (setBackgroundMaterial unavailable)");
    }
  } else {
    try {
      if (typeof overlayWindow.setVibrancy === "function") {
        overlayWindow.setVibrancy("acrylic");
        debugLog("Applying vibrancy... success");
      }
    } catch (error) {
      debugLog(
        `Applying vibrancy... failed (${error?.message || String(error)})`
      );
    }
  }
}

function createOverlayWindow() {
  if (!overlaySettings) loadOverlaySettings();
  const overlayBounds = getFullscreenBounds();
  startTelemetryEmitter();
  overlayFullBounds = overlayBounds;

  const windowOptions = {
    ...overlayBounds,
    show: false,
    transparent: OVERLAY_TRANSPARENT,
    frame: false,
    resizable: false,
    movable: false,
    fullscreen: false,
    fullscreenable: false,
    alwaysOnTop: true,
    hasShadow: false,
    skipTaskbar: true,
    backgroundColor: OVERLAY_BG_COLOR,
    icon: getAppIconPath() || undefined,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  overlayWindow = new BrowserWindow(windowOptions);

  debugLog(`platform: ${process.platform}`);
  debugLog(
    `window transparent=${windowOptions.transparent} backgroundColor=${windowOptions.backgroundColor}`
  );
  debugLog(
    `setBackgroundMaterial available: ${
      typeof overlayWindow.setBackgroundMaterial === "function"
    }`
  );

  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setOpacity(0);
  overlayWindow.setIgnoreMouseEvents(Boolean(overlaySettings.clickThrough), {
    forward: true,
  });
  overlayWindow.setFocusable(!overlaySettings.clickThrough);
  overlayWindow.on("focus", () => {
    setOverlayFocused(true, "window-focus");
  });
  overlayWindow.on("blur", () => {
    setOverlayFocused(false, "window-blur");
    scheduleOverlayRefocus("blur");
  });
  overlayWindow.on("show", () => {
    overlayVisible = true;
    hideMiniToggleWindow();
  });
  overlayWindow.on("hide", () => {
    overlayVisible = false;
    showMiniToggleWindow();
  });
  overlayWindow.on("minimize", () => {
    setOverlayManualHidden(true, "minimize");
  });
  overlayWindow.on("restore", () => {
    setOverlayManualHidden(false, "restore");
    showOverlay();
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
    overlayReady = false;
    overlayVisible = false;
    setOverlayFocused(false, "window-closed");
    stopTelemetryEmitter();
    hideMiniToggleWindow();
  });

  overlayWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url) {
      return { action: "deny" };
    }
    suppressOverlayRefocus = true;
    const child = new BrowserWindow({
      width: 900,
      height: 700,
      show: true,
      parent: overlayWindow,
      modal: false,
      autoHideMenuBar: true,
      backgroundColor: OVERLAY_BG_COLOR,
      icon: getAppIconPath() || undefined,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    child.on("closed", () => {
      suppressOverlayRefocus = false;
      if (!overlayManuallyHidden) {
        showOverlay("child-window-closed");
      }
    });

    child.loadURL(url).catch(() => {
      suppressOverlayRefocus = false;
      try {
        child.close();
      } catch {
        // ignore
      }
    });

    return { action: "deny" };
  });

  overlayWindow.webContents.on("did-finish-load", () => {
    if (
      !overlayWindow ||
      overlayWindow.isDestroyed() ||
      !overlayWindow.webContents ||
      overlayWindow.webContents.isDestroyed()
    ) {
      return;
    }
    // Renderer reloads can miss the initial subscription; always push once on load.
    const payload = latestTelemetryState || buildTelemetryState();
    overlayWindow.webContents.send("hmcc:telemetry", payload);
    updateOverlayContentMode();
  });

  applyOverlayEffects();
  loadOverlayContent();
  overlayWindow.once("ready-to-show", () => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;
    applyOverlayEffects();
    overlayReady = true;
    overlayVisible = false;
    debugLog("overlay ready-to-show");
    recomputeOverlayVisibility("ready");
    updateOverlayContentMode();
  });
}

function normalizeOverlayBounds(bounds) {
  const primary = screen.getPrimaryDisplay();
  const width = Math.max(
    320,
    Math.min(
      bounds.width || DEFAULT_OVERLAY_SETTINGS.bounds.width,
      primary.workArea.width
    )
  );
  const height = Math.max(
    160,
    Math.min(
      bounds.height || DEFAULT_OVERLAY_SETTINGS.bounds.height,
      primary.workArea.height
    )
  );

  let x = Number.isFinite(bounds.x) ? bounds.x : null;
  let y = Number.isFinite(bounds.y) ? bounds.y : null;

  const display = Number.isFinite(x) && Number.isFinite(y)
    ? screen.getDisplayMatching({ x, y, width, height })
    : primary;
  const workArea = display.workArea;

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    x = Math.round(workArea.x + (workArea.width - width) / 2);
    y = Math.round(workArea.y + (workArea.height - height) / 2);
  }

  const maxX = workArea.x + workArea.width - width;
  const maxY = workArea.y + workArea.height - height;
  const minX = workArea.x;
  const minY = workArea.y;

  x = Math.min(Math.max(x, minX), maxX);
  y = Math.min(Math.max(y, minY), maxY);

  overlaySettings.bounds = { width, height, x, y };
  saveConfig();

  return { width, height, x, y };
}

function buildTelemetryState() {
  const state = provider?.getState ? provider.getState() : {};
  const telemetry = getTelemetryStatus();
  const isTelemetry = telemetry?.provider === "telemetry";
  const stale = Boolean(telemetry?.stale);
  let status = "inactive";
  if (isTelemetry && stale) {
    status = "stale";
  } else if (state?.isCustomGame) {
    const players = Number(state.currentPlayers || 0);
    status = players <= 1 ? "waiting" : "active";
  }

  return {
    status,
    map: state.map || "Unknown",
    mode: state.mode || "Unknown",
    currentPlayers: Number(state.currentPlayers || 0),
    maxPlayers: Number(state.maxPlayers || 0),
    mapUpdatedThisTick:
      typeof state.mapUpdatedThisTick === "boolean"
        ? state.mapUpdatedThisTick
        : null,
    modeUpdatedThisTick:
      typeof state.modeUpdatedThisTick === "boolean"
        ? state.modeUpdatedThisTick
        : null,
    playersUpdatedThisTick:
      typeof state.playersUpdatedThisTick === "boolean"
        ? state.playersUpdatedThisTick
        : null,
    hostName: state.hostName || "Host",
    requiredMods: Array.isArray(state.requiredMods) ? state.requiredMods : [],
    sessionId: state.sessionId || "",
    timestamp: state.timestamp || null,
    lastUpdatedAt: telemetry?.lastUpdatedAt || null,
    parseOk: telemetry?.parseOk !== undefined ? Boolean(telemetry.parseOk) : null,
    lastParseError: telemetry?.lastParseError || null,
    consecutiveParseErrors: Number(telemetry?.consecutiveParseErrors || 0),
    lastGoodAgeMs:
      telemetry?.lastGoodAgeMs !== undefined ? telemetry.lastGoodAgeMs : null,
    telemetryFileMtimeMs:
      telemetry?.lastFileMtimeMs !== undefined ? telemetry.lastFileMtimeMs : null,
  };
}

function setupIpc() {
  ipcMain.handle("lobbies:list", () => store.listLobbies());
  ipcMain.handle("lobbies:create", (_event, input) => {
    const lobby = store.createLobby(input || {});
    emitTelemetryUpdate();
    return lobby;
  });
  ipcMain.handle("lobbies:update", (_event, id, patch) => {
    const lobby = store.updateLobby(id, patch || {});
    emitTelemetryUpdate();
    return lobby;
  });
  ipcMain.handle("lobbies:heartbeat", (_event, id) => {
    const lobby = store.heartbeatLobby(id);
    emitTelemetryUpdate();
    return lobby;
  });
  ipcMain.handle("lobbies:close", (_event, id) => {
    const lobby = store.closeLobby(id);
    emitTelemetryUpdate();
    return lobby;
  });
  ipcMain.handle("lobbies:delete", (_event, id) => {
    const lobby = store.deleteLobby(id);
    emitTelemetryUpdate();
    return lobby;
  });

  ipcMain.handle("requests:list", (_event, lobbyId) =>
    store.listRequests(lobbyId)
  );
  ipcMain.handle("requests:add", (_event, payload) => {
    const request = store.addRequest(payload || {});
    emitTelemetryUpdate();
    return request;
  });
  ipcMain.handle("requests:respond", (_event, payload) => {
    const request = store.respondRequest(payload || {});
    emitTelemetryUpdate();
    return request;
  });

  ipcMain.handle("mods:setInstalled", (_event, mods) => {
    const next = store.setInstalledMods(mods || []);
    emitTelemetryUpdate();
    return next;
  });
  ipcMain.handle("mods:getInstalled", () => store.getInstalledMods());
  ipcMain.handle("mods:scan", () => scanDefaultModPaths());
  ipcMain.handle("mods:validate", (_event, requiredMods) =>
    store.validateMods(requiredMods || [])
  );

  ipcMain.handle("monitor:start", () => {
    monitor.start();
    return { running: true };
  });
  ipcMain.handle("monitor:stop", () => {
    monitor.stop();
    return { running: false };
  });
  ipcMain.handle("monitor:setState", (_event, state) => {
    if (provider && provider.setState) {
      provider.setState(state || {});
      return monitor.checkGameState().then(() => provider.getState());
    }
    return provider.getState();
  });
  ipcMain.handle("monitor:getState", () => provider.getState());

  ipcMain.handle("telemetry:getStatus", () => getTelemetryStatus());
  ipcMain.handle("telemetry:setPath", (_event, filePath) => {
    telemetryPath = resolveTelemetryPath(filePath);
    saveConfig();
    if (telemetryPath) {
      ensureCustomsStateExists({ filePath: telemetryPath, logger: console });
    }
    if (useTelemetry) {
      const telemetryProvider = new FileGameStateProvider({
        filePath: telemetryPath,
      });
      setProvider(telemetryProvider, "telemetry");
      monitor.start();
    }
    return getTelemetryStatus();
  });
  ipcMain.handle("telemetry:useTelemetry", () => {
    if (telemetryPath) {
      ensureCustomsStateExists({ filePath: telemetryPath, logger: console });
    }
    const telemetryProvider = new FileGameStateProvider({
      filePath: telemetryPath,
    });
    setProvider(telemetryProvider, "telemetry");
    monitor.start();
    saveConfig();
    return getTelemetryStatus();
  });
  ipcMain.handle("telemetry:useSimulated", () => {
    const simulated = new SimulatedGameStateProvider();
    setProvider(simulated, "simulated");
    saveConfig();
    return getTelemetryStatus();
  });
  ipcMain.handle("telemetry:select", async () =>
    withOverlayFocusRestore(async () => {
      const result = await dialog.showOpenDialog({
        title: "Select MCC telemetry JSON",
        properties: ["openFile"],
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || result.filePaths.length === 0) return null;
      telemetryPath = resolveTelemetryPath(result.filePaths[0]);
      saveConfig();
      if (telemetryPath) {
        ensureCustomsStateExists({ filePath: telemetryPath, logger: console });
      }
      if (useTelemetry) {
        const telemetryProvider = new FileGameStateProvider({
          filePath: telemetryPath,
        });
        setProvider(telemetryProvider, "telemetry");
        monitor.start();
      }
      return telemetryPath;
    }, "telemetry-dialog")
  );

  ipcMain.handle("hmcc:getState", () =>
    latestTelemetryState || buildTelemetryState()
  );
  ipcMain.handle("hmcc:getAppVersion", () => app.getVersion());
  ipcMain.handle("hmcc:isHaloRunning", () =>
    mccRunning === null ? true : Boolean(mccRunning)
  );
  ipcMain.handle("hmcc:update_check", async () => {
    if (!app.isPackaged) {
      return { ok: false, code: "DEV_MODE", message: "Updates disabled in development." };
    }
    if (!ensureAutoUpdaterLoaded()) {
      return { ok: false, code: "UPDATER_MISSING", message: "Updater unavailable." };
    }
    if (updateState.status === "downloaded") {
      return {
        ok: true,
        status: "downloaded",
        version: updateState.version,
        releaseNotes: updateState.releaseNotes,
      };
    }
    if (updateState.status === "downloading") {
      return {
        ok: true,
        status: "downloading",
        progress: updateState.progress,
      };
    }
    try {
      updateState = { status: "checking", version: null, releaseNotes: null, progress: null };
      const result = await autoUpdater.checkForUpdates();
      const info = result?.updateInfo;
      const version = info?.version || null;
      const releaseNotes = normalizeReleaseNotes(info?.releaseNotes);
      if (version && version !== app.getVersion()) {
        updateState = { status: "update-available", version, releaseNotes, progress: null };
        return { ok: true, status: "update-available", version, releaseNotes };
      }
      updateState = { status: "no-update", version: app.getVersion(), releaseNotes: null, progress: null };
      return { ok: true, status: "no-update" };
    } catch (error) {
      const message = error?.message || String(error);
      updateState = { status: "error", version: null, releaseNotes: null, progress: null };
      return { ok: false, code: "CHECK_FAILED", message };
    }
  });
  ipcMain.handle("hmcc:update_download", async () => {
    if (!app.isPackaged) {
      return { ok: false, code: "DEV_MODE", message: "Updates disabled in development." };
    }
    if (!ensureAutoUpdaterLoaded()) {
      return { ok: false, code: "UPDATER_MISSING", message: "Updater unavailable." };
    }
    if (updateState.status === "downloaded") {
      return {
        ok: true,
        status: "downloaded",
        version: updateState.version,
        releaseNotes: updateState.releaseNotes,
      };
    }
    if (updateDownloadPromise) {
      return updateDownloadPromise;
    }
    updateInProgress = true;
    updateDownloadPromise = autoUpdater
      .downloadUpdate()
      .then((info) => {
        const version = info?.version || updateState.version || null;
        const releaseNotes = normalizeReleaseNotes(info?.releaseNotes);
        updateState = {
          status: "downloaded",
          version,
          releaseNotes,
          progress: 100,
        };
        return { ok: true, status: "downloaded", version, releaseNotes };
      })
      .catch((error) => {
        updateInProgress = false;
        const message = error?.message || String(error);
        updateState = { status: "error", version: null, releaseNotes: null, progress: null };
        return { ok: false, code: "DOWNLOAD_FAILED", message };
      })
      .finally(() => {
        updateDownloadPromise = null;
      });
    return updateDownloadPromise;
  });
  ipcMain.handle("hmcc:update_install", async () => {
    if (!app.isPackaged) {
      return { ok: false, code: "DEV_MODE", message: "Updates disabled in development." };
    }
    if (!ensureAutoUpdaterLoaded()) {
      return { ok: false, code: "UPDATER_MISSING", message: "Updater unavailable." };
    }
    updateInProgress = true;
    try {
      autoUpdater.quitAndInstall();
      return { ok: true };
    } catch (error) {
      updateInProgress = false;
      const message = error?.message || String(error);
      return { ok: false, code: "INSTALL_FAILED", message };
    }
  });
  ipcMain.handle("hmcc:hideOverlayWindow", () => {
    setOverlayManualHidden(true, "ipc-hide");
    return { ok: true };
  });
  ipcMain.handle("hmcc:showOverlayWindow", () => {
    setOverlayManualHidden(false, "ipc-show");
    return { ok: true };
  });
  ipcMain.handle("hmcc:requestQuit", () => {
    app.quit();
    setTimeout(() => {
      try {
        app.exit(0);
      } catch {
        // ignore
      }
    }, 1500);
    return { ok: true };
  });
  ipcMain.on("hmcc:setDebugPanelPinned", (_event, enabled) => {
    debugPanelPinned = Boolean(enabled);
    debugLog(`debug panel pinned: ${debugPanelPinned ? "on" : "off"}`);
    recomputeOverlayVisibility("debug");
    updateOverlayContentMode();
  });
  ipcMain.handle("overlay:getState", () => buildTelemetryState());
  ipcMain.handle("overlay:getSettings", () => overlaySettings || loadOverlaySettings());
  ipcMain.handle("overlay:setSettings", (_event, patch) => {
    if (!overlaySettings) loadOverlaySettings();
    const next = { ...overlaySettings, ...(patch || {}) };
    const bounds = patch?.bounds || overlaySettings.bounds;
    next.bounds = bounds;
    overlaySettings = next;

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (typeof next.opacity === "number") {
        overlayWindow.setOpacity(Math.max(0.3, Math.min(1, next.opacity)));
      }
      if (typeof next.clickThrough === "boolean") {
        overlayWindow.setIgnoreMouseEvents(Boolean(next.clickThrough), {
          forward: true,
        });
        overlayWindow.setFocusable(!next.clickThrough);
      }
    }

    saveConfig();
    return overlaySettings;
  });

  ipcMain.handle("overlay:snap", (_event, corner) => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return null;
    const bounds = overlayWindow.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const inset = 16;
    const work = display.workArea;

    let nextX = bounds.x;
    let nextY = bounds.y;
    if (corner === "top-left") {
      nextX = work.x + inset;
      nextY = work.y + inset;
    }
    if (corner === "top-right") {
      nextX = work.x + work.width - bounds.width - inset;
      nextY = work.y + inset;
    }
    if (corner === "bottom-left") {
      nextX = work.x + inset;
      nextY = work.y + work.height - bounds.height - inset;
    }
    if (corner === "bottom-right") {
      nextX = work.x + work.width - bounds.width - inset;
      nextY = work.y + work.height - bounds.height - inset;
    }

    overlayWindow.setBounds({ ...bounds, x: nextX, y: nextY });
    overlaySettings.bounds = { ...bounds, x: nextX, y: nextY };
    saveConfig();
    return overlaySettings.bounds;
  });
}

app.whenReady().then(() => {
  const dataFile = getLobbyStorePath(app);
  configPath = getConfigPath(app);
  config = readConfig(configPath);
  loadOverlaySettings();
  telemetryPath = getCustomsStatePath(app);
  useTelemetry = true;

  const userDataPath = app.getPath("userData");
  debugLog(
    `paths: userData=${userDataPath} dataRoot=${getDataRootDir(
      app
    )} dataDir=${getAppDataDir(app)} telemetry=${telemetryPath} config=${configPath} lobbies=${dataFile}`
  );

  ensureCustomsStateExists({ filePath: telemetryPath, logger: console });

  store = new LobbyStore(dataFile);
  populator = new AutoLobbyPopulator();
  provider = useTelemetry
    ? new FileGameStateProvider({ filePath: telemetryPath })
    : new SimulatedGameStateProvider();
  monitor = new GameSessionMonitor({
    store,
    provider,
    populator,
    onUpdate: emitTelemetryUpdate,
  });
  if (provider.start) provider.start();
  monitor.start();

  setupIpc();
  startReaderProcess();
  createOverlayWindow();
  emitTelemetryUpdate();
  buildApplicationMenu();
  initAutoUpdater();
  startTelemetryEmitter();

  const shortcutRegistered = globalShortcut.register("Insert", () => {
    toggleOverlayVisibility("insert");
  });
  debugLog("Electron app ready");
  debugLog(`globalShortcut Insert registered: ${shortcutRegistered}`);
  debugLog("overlay window created");
  debugLog(`initial ${debugSnapshot()}`);
  startFocusWatcher();
  startMccWatcher();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopReaderProcess();
    stopFocusWatcher();
    stopMccWatcher();
    stopTelemetryEmitter();
    app.quit();
  }
});

app.on("before-quit", () => {
  notifyRendererShutdown("app-quit");
  globalShortcut.unregisterAll();
  stopReaderProcess();
  stopFocusWatcher();
  stopMccWatcher();
  stopTelemetryEmitter();
});

["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    requestOverlayShutdown(`signal:${signal}`);
  });
});
