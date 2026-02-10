const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const unpackedRoot = path.join(root, "dist", "win-unpacked");
const expectedReader = path.join(
  unpackedRoot,
  "resources",
  "bin",
  "mcc_player_overlay.exe"
);

if (!fs.existsSync(unpackedRoot)) {
  console.error(`[check-packaged-reader] Missing unpacked app folder: ${unpackedRoot}`);
  process.exit(1);
}

if (!fs.existsSync(expectedReader)) {
  console.error(
    `[check-packaged-reader] Missing reader exe in packaged output: ${expectedReader}`
  );
  console.error(
    "[check-packaged-reader] Installer packaging misconfigured: expected reader at {resources}/bin/mcc_player_overlay.exe"
  );
  process.exit(1);
}

console.log(`[check-packaged-reader] OK: ${expectedReader}`);
