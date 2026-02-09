const fs = require("fs");
const path = require("path");

function getDefaultModPaths() {
  const paths = [];
  const programFilesX86 = process.env["ProgramFiles(x86)"];
  const programFiles = process.env.ProgramFiles;
  const userProfile = process.env.USERPROFILE;

  const steamBase = programFilesX86 || programFiles || "C:\\Program Files (x86)";
  paths.push(
    path.join(
      steamBase,
      "Steam",
      "steamapps",
      "common",
      "Halo The Master Chief Collection",
      "Mods"
    )
  );

  if (userProfile) {
    paths.push(path.join(userProfile, "Documents", "Halo MCC", "Mods"));
  }

  return Array.from(new Set(paths));
}

function scanModDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter(Boolean);
}

function scanDefaultModPaths() {
  const paths = getDefaultModPaths();
  const mods = [];

  paths.forEach((dirPath) => {
    try {
      mods.push(...scanModDirectory(dirPath));
    } catch {
      // ignore errors for paths we cannot read
    }
  });

  return {
    paths,
    mods: Array.from(new Set(mods)),
  };
}

module.exports = { scanDefaultModPaths };
