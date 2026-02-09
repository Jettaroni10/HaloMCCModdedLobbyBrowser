const maps = require("./data/maps.json");
const modes = require("./data/modes.json");

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function findMatch(table, name, fallback) {
  const target = normalizeKey(name);
  const key = Object.keys(table).find(
    (entry) => normalizeKey(entry) === target
  );
  if (!key) {
    return { name: name || fallback.name, ...fallback };
  }
  return { name: key, ...table[key] };
}

class AutoLobbyPopulator {
  extractMods(gameData) {
    const mods = [];
    if (Array.isArray(gameData.modList)) {
      mods.push(...gameData.modList);
    }
    if (Array.isArray(gameData.mapMods)) {
      mods.push(...gameData.mapMods);
    }
    if (Array.isArray(gameData.mods)) {
      mods.push(...gameData.mods);
    }
    return Array.from(
      new Set(mods.map((mod) => String(mod || "").trim()).filter(Boolean))
    );
  }

  async getMapDetails(mapName) {
    return findMatch(maps, mapName, {
      type: "Unknown",
      size: "Unknown",
      description: "No map details available yet.",
      thumbnail: "",
    });
  }

  async getGameModeDetails(gameMode) {
    return findMatch(modes, gameMode, {
      description: "No mode details available yet.",
      recommendedMap: "",
      settings: {},
    });
  }

  async getModDetails(modIds) {
    const details = {};
    modIds.forEach((modId) => {
      details[modId] = {
        id: modId,
        name: modId,
        source: "local",
      };
    });
    return details;
  }

  async buildLobbyInfo(gameData) {
    const mapName = gameData.mapName || gameData.map || "Unknown";
    const gameMode = gameData.gameMode || gameData.mode || "Custom";
    const playlist = gameData.playlist || "";
    const mods = this.extractMods(gameData);

    const mapInfo = await this.getMapDetails(mapName);
    const modeInfo = await this.getGameModeDetails(gameMode);
    const modDetails = mods.length ? await this.getModDetails(mods) : {};

    return {
      title: `${mapName} - ${gameMode}`,
      map: mapName,
      mode: gameMode,
      playlist,
      requiredMods: mods,
      isModded: mods.length > 0,
      mapInfo,
      modeInfo,
      modDetails,
      autoPopulated: true,
      isPublic: true,
    };
  }
}

module.exports = { AutoLobbyPopulator };
