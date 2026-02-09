class SimulatedGameStateProvider {
  constructor() {
    this.state = {
      isCustomGame: false,
      title: "Custom Lobby",
      game: "MCC",
      mode: "Custom",
      map: "Unknown",
      hostName: "Host",
      maxPlayers: 16,
      currentPlayers: 1,
      isModded: false,
      requiredMods: [],
    };
  }

  start() {
    // no-op
  }

  stop() {
    // no-op
  }

  setState(next) {
    this.state = { ...this.state, ...next };
  }

  getState() {
    return { ...this.state };
  }

  getStatus() {
    return {
      provider: "simulated",
      filePath: "",
      exists: false,
      lastUpdatedAt: null,
      stale: false,
      error: null,
    };
  }
}

class GameSessionMonitor {
  constructor({ store, provider, onUpdate, populator }) {
    this.store = store;
    this.provider = provider;
    this.onUpdate = onUpdate;
    this.populator = populator;
    this.interval = null;
    this.activeLobbyId = null;
    this.activeSessionId = null;
    this.isChecking = false;
  }

  setProvider(provider) {
    this.provider = provider;
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => void this.checkGameState(), 1000);
  }

  stop() {
    if (!this.interval) return;
    clearInterval(this.interval);
    this.interval = null;
  }

  async checkGameState() {
    if (this.isChecking) return;
    this.isChecking = true;
    try {
      const state = this.provider.getState();
      if (state.isCustomGame) {
        await this.handleCustomGameStart(state);
      } else {
        this.handleCustomGameEnd();
      }
    } finally {
      this.isChecking = false;
    }
  }

  async handleCustomGameStart(state) {
    const enriched = this.populator
      ? await this.populator.buildLobbyInfo(state)
      : {};
    const requiredMods =
      Array.isArray(state.requiredMods) && state.requiredMods.length > 0
        ? state.requiredMods
        : enriched.requiredMods || [];
    const isModded =
      typeof state.isModded === "boolean" ? state.isModded : enriched.isModded;

    const lobbyInput = {
      ...enriched,
      title: state.title || enriched.title,
      game: state.game || enriched.game,
      mode: state.mode || enriched.mode,
      map: state.map || enriched.map,
      playlist: state.playlist || enriched.playlist,
      hostName: state.hostName || "Host",
      sessionId: state.sessionId || "",
      telemetryTimestamp: state.timestamp || null,
      maxPlayers: state.maxPlayers || 16,
      currentPlayers: state.currentPlayers || 1,
      isModded,
      requiredMods,
      source: "monitor",
    };

    const nextSessionId = String(lobbyInput.sessionId || "").trim();
    if (
      this.activeLobbyId &&
      this.activeSessionId &&
      nextSessionId &&
      this.activeSessionId !== nextSessionId
    ) {
      this.store.closeLobby(this.activeLobbyId);
      this.activeLobbyId = null;
      this.activeSessionId = null;
    }

    if (!this.activeLobbyId) {
      const lobby = this.store.createLobby(lobbyInput);
      this.activeLobbyId = lobby.id;
      this.activeSessionId = nextSessionId || null;
      this.onUpdate?.();
      return;
    }

    this.store.updateLobby(this.activeLobbyId, {
      ...lobbyInput,
      status: "active",
      lastHeartbeatAt: new Date().toISOString(),
    });
    this.activeSessionId = nextSessionId || this.activeSessionId;
    this.onUpdate?.();
  }

  handleCustomGameEnd() {
    if (!this.activeLobbyId) return;
    this.store.closeLobby(this.activeLobbyId);
    this.activeLobbyId = null;
    this.activeSessionId = null;
    this.onUpdate?.();
  }
}

module.exports = { GameSessionMonitor, SimulatedGameStateProvider };
