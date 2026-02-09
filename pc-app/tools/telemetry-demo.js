const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const appData = process.env.APPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Roaming");
const outputPath = path.join(appData, "MCC", "customs_state.json");

const sessionId = crypto.randomUUID().replace(/-/g, "");
let tick = 0;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeSnapshot(isCustomGame) {
  const playerCount = isCustomGame ? 4 + (tick % 8) : 0;
  const payload = {
    version: "1.0",
    data: {
      isCustomGame,
      mapName: "Valhalla",
      gameMode: "Slayer",
      playlist: "Custom",
      playerCount,
      maxPlayers: 16,
      hostName: "OfflineHost",
      mods: ["example_mod_a", "example_mod_b"],
      timestamp: new Date().toISOString(),
      sessionID: sessionId,
    },
  };

  ensureDir(outputPath);
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");
}

function shutdown() {
  writeSnapshot(false);
  process.exit(0);
}

console.log(`Writing telemetry to: ${outputPath}`);
console.log("Press Ctrl+C to stop. The script writes inactive state on exit.");

writeSnapshot(true);
const timer = setInterval(() => {
  tick += 1;
  writeSnapshot(true);
}, 2000);

process.on("SIGINT", () => {
  clearInterval(timer);
  shutdown();
});

process.on("SIGTERM", () => {
  clearInterval(timer);
  shutdown();
});
