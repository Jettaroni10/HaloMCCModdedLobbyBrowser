const { spawnSync } = require("child_process");

const PROCESS_NAMES = [
  "mcc_player_overlay.exe",
  "electron.exe",
  "HMCC Overlay.exe",
];

function killWindowsProcess(name) {
  const result = spawnSync("taskkill", ["/F", "/IM", name], {
    stdio: "pipe",
    shell: false,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
  const notFound = output.toLowerCase().includes("not found");
  if (result.status === 0 || notFound) {
    return;
  }
  console.warn(`[kill-overlay] Failed killing ${name}: ${output || result.status}`);
}

if (process.platform === "win32") {
  PROCESS_NAMES.forEach(killWindowsProcess);
} else {
  ["mcc_player_overlay", "electron"].forEach((name) => {
    spawnSync("pkill", ["-f", name], { stdio: "ignore" });
  });
}
