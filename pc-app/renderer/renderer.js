const statusEl = document.getElementById("monitor-status");
const monitorForm = document.getElementById("monitor-form");
const modsForm = document.getElementById("mods-form");
const createForm = document.getElementById("create-form");
const lobbiesContainer = document.getElementById("lobbies");
const refreshButton = document.getElementById("refresh-button");
const modsScanButton = document.getElementById("mods-scan");
const modsScanResult = document.getElementById("mods-scan-result");
const telemetryPathInput = document.getElementById("telemetry-path");
const telemetryChooseButton = document.getElementById("telemetry-choose");
const telemetryConnectButton = document.getElementById("telemetry-connect");
const telemetryDisconnectButton = document.getElementById("telemetry-disconnect");
const telemetryStatus = document.getElementById("telemetry-status");

let monitorRunning = false;
let currentLobbies = [];
let currentRequests = [];
let installedMods = [];

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseMods(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function setMonitorStatus(running) {
  monitorRunning = running;
  statusEl.textContent = `Monitor: ${running ? "running" : "stopped"}`;
}

function fillMonitorForm(state) {
  document.getElementById("monitor-custom").checked = Boolean(
    state.isCustomGame
  );
  document.getElementById("monitor-title").value = state.title || "";
  document.getElementById("monitor-game").value = state.game || "";
  document.getElementById("monitor-mode").value = state.mode || "";
  document.getElementById("monitor-map").value = state.map || "";
  document.getElementById("monitor-host").value = state.hostName || "";
  document.getElementById("monitor-current").value =
    state.currentPlayers || "";
  document.getElementById("monitor-max").value = state.maxPlayers || "";
  document.getElementById("monitor-modded").checked = Boolean(state.isModded);
  document.getElementById("monitor-mods").value =
    (state.requiredMods || []).join(", ");
}

async function loadMonitorState() {
  const state = await window.api.monitorGetState();
  fillMonitorForm(state);
}

async function refreshAll() {
  currentLobbies = await window.api.listLobbies();
  currentRequests = await window.api.listRequests();
  installedMods = await window.api.getInstalledMods();
  const modsInput = document.getElementById("mods-installed");
  if (modsInput && !modsInput.matches(":focus")) {
    modsInput.value = installedMods.join(", ");
  }
  renderLobbies();
  await refreshTelemetryStatus();
}

async function refreshTelemetryStatus() {
  if (!telemetryStatus) return;
  const status = await window.api.telemetryGetStatus();
  if (telemetryPathInput && !telemetryPathInput.matches(":focus")) {
    telemetryPathInput.value = status.filePath || "";
  }
  const parts = [`Provider: ${status.provider}`];
  if (status.provider === "telemetry") {
    parts.push(status.exists ? "File: found" : "File: missing");
    if (status.schemaVersion) {
      parts.push(`Schema: ${status.schemaVersion}`);
    }
    if (
      status.expectedSchemaVersion &&
      status.schemaVersion &&
      status.schemaVersion !== status.expectedSchemaVersion
    ) {
      parts.push(
        `Expected schema: ${status.expectedSchemaVersion} (mismatch)`
      );
    }
    if (status.lastUpdatedAt) {
      parts.push(
        `Last update: ${new Date(status.lastUpdatedAt).toLocaleTimeString()}`
      );
    }
    if (status.stale) parts.push("Status: stale");
    if (Array.isArray(status.validationIssues) && status.validationIssues.length) {
      parts.push(`Validation: ${status.validationIssues.join("; ")}`);
    }
    if (status.error) parts.push(`Error: ${status.error}`);
  }
  telemetryStatus.textContent = parts.join(" | ");
}

function renderLobbies() {
  if (!currentLobbies.length) {
    lobbiesContainer.innerHTML =
      '<div class="empty">No lobbies yet. Publish one or start the monitor.</div>';
    return;
  }

  const cards = currentLobbies.map((lobby) => {
    const missing = (lobby.requiredMods || []).filter(
      (mod) => !installedMods.includes(String(mod).toLowerCase())
    );
    const requests = currentRequests.filter(
      (req) => req.lobbyId === lobby.id
    );

    const tags = [
      lobby.status === "active" ? "Active" : "Closed",
      lobby.source === "monitor" ? "Monitor" : "Manual",
      lobby.autoPopulated ? "Auto" : "Manual Data",
      lobby.isModded ? "Modded" : "Vanilla",
      `Players ${lobby.currentPlayers || 0}/${lobby.maxPlayers || "?"}`,
    ];
    if (lobby.sessionId) {
      tags.push(`Session ${lobby.sessionId.slice(0, 8)}`);
    }

    const requestHtml = requests.length
      ? requests
          .map(
            (req) => `
        <div class="request">
          <div>
            <strong>${escapeHtml(req.playerName)}</strong>
            <div class="muted">${escapeHtml(req.status)}</div>
          </div>
          <div class="request-actions">
            <button class="primary" data-action="accept" data-request-id="${req.id}">Accept</button>
            <button class="ghost" data-action="reject" data-request-id="${req.id}">Reject</button>
          </div>
        </div>
      `
          )
          .join("")
      : '<div class="muted">No join requests.</div>';

    const modsLine = lobby.requiredMods?.length
      ? `Required mods: ${escapeHtml(lobby.requiredMods.join(", "))}`
      : "No mod requirements.";

    const missingLine = missing.length
      ? `<div class="muted" style="color: var(--accent-2)">Missing mods: ${escapeHtml(
          missing.join(", ")
        )}</div>`
      : '<div class="muted">All required mods installed.</div>';

    const mapInfo = lobby.mapInfo
      ? `<div class="muted">Map info: ${escapeHtml(
          lobby.mapInfo.type
        )} · ${escapeHtml(lobby.mapInfo.size)} · ${escapeHtml(
          lobby.mapInfo.description
        )}</div>`
      : '<div class="muted">Map info: unavailable.</div>';

    const modeInfo = lobby.modeInfo
      ? `<div class="muted">Mode info: ${escapeHtml(
          lobby.modeInfo.description
        )}</div>`
      : '<div class="muted">Mode info: unavailable.</div>';

    return `
      <div class="lobby-card" data-lobby-id="${lobby.id}">
        <div class="lobby-header">
          <div>
            <h3 class="lobby-title">${escapeHtml(lobby.title)}</h3>
            <div class="muted">${escapeHtml(
              lobby.game
            )} · ${escapeHtml(lobby.mode)} · ${escapeHtml(lobby.map)}</div>
            <div class="muted">Host: ${escapeHtml(lobby.hostName)}</div>
          </div>
          <div class="button-row">
            <button class="ghost" data-action="heartbeat">Heartbeat</button>
            <button class="ghost" data-action="request">Request join</button>
            <button class="ghost" data-action="close">Close</button>
            <button class="danger" data-action="delete">Delete</button>
          </div>
        </div>
        <div class="tag-row">
          ${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}
        </div>
        <div class="muted">${modsLine}</div>
        ${mapInfo}
        ${modeInfo}
        ${missingLine}
        <div>
          <h4 class="muted" style="margin: 6px 0;">Join Requests</h4>
          <div class="request-list">${requestHtml}</div>
        </div>
      </div>
    `;
  });

  lobbiesContainer.innerHTML = cards.join("");
}

function getMonitorStateFromForm() {
  return {
    isCustomGame: document.getElementById("monitor-custom").checked,
    title: document.getElementById("monitor-title").value,
    game: document.getElementById("monitor-game").value,
    mode: document.getElementById("monitor-mode").value,
    map: document.getElementById("monitor-map").value,
    hostName: document.getElementById("monitor-host").value,
    currentPlayers: Number(
      document.getElementById("monitor-current").value || 1
    ),
    maxPlayers: Number(document.getElementById("monitor-max").value || 16),
    isModded: document.getElementById("monitor-modded").checked,
    requiredMods: parseMods(document.getElementById("monitor-mods").value),
  };
}

function getCreateLobbyPayload() {
  return {
    title: document.getElementById("create-title").value,
    game: document.getElementById("create-game").value,
    mode: document.getElementById("create-mode").value,
    map: document.getElementById("create-map").value,
    hostName: document.getElementById("create-host").value,
    currentPlayers: Number(
      document.getElementById("create-current").value || 1
    ),
    maxPlayers: Number(document.getElementById("create-max").value || 16),
    isModded: document.getElementById("create-modded").checked,
    requiredMods: parseMods(document.getElementById("create-mods").value),
  };
}

function bindEvents() {
  document.getElementById("monitor-start").addEventListener("click", async () => {
    await window.api.monitorStart();
    setMonitorStatus(true);
  });

  document.getElementById("monitor-stop").addEventListener("click", async () => {
    await window.api.monitorStop();
    setMonitorStatus(false);
  });

  monitorForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.api.monitorSetState(getMonitorStateFromForm());
    await refreshAll();
  });

  modsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = document.getElementById("mods-installed");
    await window.api.setInstalledMods(parseMods(input.value));
    await refreshAll();
  });

  modsScanButton.addEventListener("click", async () => {
    const result = await window.api.scanMods();
    const merged = Array.from(
      new Set([...(installedMods || []), ...(result.mods || [])])
    );
    await window.api.setInstalledMods(merged);
    if (modsScanResult) {
      const count = result.mods ? result.mods.length : 0;
      const paths = result.paths ? result.paths.join(" | ") : "";
      modsScanResult.textContent =
        count > 0
          ? `Found ${count} mods in: ${paths}`
          : `No mods found in: ${paths}`;
    }
    await refreshAll();
  });

  telemetryChooseButton.addEventListener("click", async () => {
    const selected = await window.api.telemetrySelect();
    if (selected && telemetryPathInput) {
      telemetryPathInput.value = selected;
      await window.api.telemetrySetPath(selected);
    }
    await refreshTelemetryStatus();
  });

  telemetryConnectButton.addEventListener("click", async () => {
    const value = telemetryPathInput ? telemetryPathInput.value : "";
    if (value) {
      await window.api.telemetrySetPath(value);
    }
    await window.api.telemetryUseTelemetry();
    await refreshTelemetryStatus();
  });

  telemetryDisconnectButton.addEventListener("click", async () => {
    await window.api.telemetryUseSimulated();
    await refreshTelemetryStatus();
  });

  createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await window.api.createLobby(getCreateLobbyPayload());
    createForm.reset();
    await refreshAll();
  });

  refreshButton.addEventListener("click", refreshAll);

  lobbiesContainer.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const card = button.closest(".lobby-card");
    const lobbyId = card?.dataset.lobbyId;

    if (!lobbyId) return;

    if (action === "heartbeat") {
      await window.api.heartbeatLobby(lobbyId);
    }

    if (action === "close") {
      await window.api.closeLobby(lobbyId);
    }

    if (action === "delete") {
      const ok = window.confirm("Delete this lobby and its requests?");
      if (ok) {
        await window.api.deleteLobby(lobbyId);
      }
    }

    if (action === "request") {
      const playerName = window.prompt("Player name?");
      if (playerName) {
        await window.api.addRequest({ lobbyId, playerName });
      }
    }

    if (action === "accept" || action === "reject") {
      const requestId = button.dataset.requestId;
      if (requestId) {
        await window.api.respondRequest({
          requestId,
          decision: action === "accept" ? "accept" : "reject",
        });
      }
    }

    await refreshAll();
  });
}

window.api.onDataUpdated(() => {
  refreshAll();
});

(async () => {
  bindEvents();
  await loadMonitorState();
  await refreshAll();
  setMonitorStatus(monitorRunning);
})();
