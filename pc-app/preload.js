const { contextBridge, ipcRenderer } = require("electron");

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function sanitize(payload) {
  if (Array.isArray(payload)) {
    return payload.map(sanitize);
  }
  if (isPlainObject(payload)) {
    const next = {};
    for (const [key, value] of Object.entries(payload)) {
      next[key] = sanitize(value);
    }
    return next;
  }
  if (
    payload === null ||
    typeof payload === "string" ||
    typeof payload === "number" ||
    typeof payload === "boolean"
  ) {
    return payload;
  }
  return null;
}

contextBridge.exposeInMainWorld("hmccOverlay", {
  getAppVersion: async () => {
    const version = await ipcRenderer.invoke("hmcc:getAppVersion");
    return typeof version === "string" ? version : "";
  },
  updateCheck: async () => ipcRenderer.invoke("hmcc:update_check"),
  updateDownload: async () => ipcRenderer.invoke("hmcc:update_download"),
  updateInstall: async () => ipcRenderer.invoke("hmcc:update_install"),
  hideOverlayWindow: async () => {
    const result = await ipcRenderer.invoke("hmcc:hideOverlayWindow");
    return Boolean(result?.ok);
  },
  showOverlayWindow: async () => {
    const result = await ipcRenderer.invoke("hmcc:showOverlayWindow");
    return Boolean(result?.ok);
  },
  requestQuit: async () => {
    const result = await ipcRenderer.invoke("hmcc:requestQuit");
    return Boolean(result?.ok);
  },
  isHaloRunning: async () => {
    const result = await ipcRenderer.invoke("hmcc:isHaloRunning");
    return Boolean(result);
  },
  onShutdown: (handler) => {
    if (typeof handler !== "function") return () => {};
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("hmcc:shutdown", listener);
    return () => {
      ipcRenderer.off("hmcc:shutdown", listener);
    };
  },
  setDebugPanelPinned: (enabled) => {
    ipcRenderer.send("hmcc:setDebugPanelPinned", Boolean(enabled));
  },
  getState: async () => {
    const data = await ipcRenderer.invoke("hmcc:getState");
    return sanitize(data);
  },
  subscribe: (callback) => {
    if (typeof callback !== "function") return () => {};

    let active = true;
    const emit = (payload) => {
      if (!active) return;
      callback(sanitize(payload));
    };

    ipcRenderer
      .invoke("hmcc:getState")
      .then((payload) => emit(payload))
      .catch(() => {});

    const handler = (_event, payload) => emit(payload);
    ipcRenderer.on("hmcc:telemetry", handler);

    return () => {
      active = false;
      ipcRenderer.off("hmcc:telemetry", handler);
    };
  },
});
