const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function listFiles(dir, predicate) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full, predicate));
    } else if (predicate(full)) {
      files.push(full);
    }
  }
  return files;
}

const analyticsDir = path.join(ROOT, "components", "analytics");
const overlayDir = path.join(ROOT, "components");

const analyticsFiles = listFiles(analyticsDir, (file) => file.endsWith(".ts") || file.endsWith(".tsx"));
const overlayFiles = listFiles(overlayDir, (file) => {
  const name = path.basename(file);
  if (!name.startsWith("Overlay")) return false;
  return file.endsWith(".ts") || file.endsWith(".tsx");
});

const files = [...new Set([...analyticsFiles, ...overlayFiles])];

let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  const firstNonEmpty = lines.find((line) => line.trim().length > 0) || "";
  const hasUseClient = firstNonEmpty.trim() === '"use client";';
  const firstUseEffectLine = lines.findIndex((line) => line.includes("useEffect("));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const windowIndex = line.indexOf("window.");
    if (windowIndex === -1) continue;

    if (!hasUseClient) {
      console.error(
        `SSR window check failed: ${file}:${i + 1} uses window without "use client".`
      );
      failed = true;
    }

    if (firstUseEffectLine !== -1 && i < firstUseEffectLine) {
      console.error(
        `SSR window check failed: ${file}:${i + 1} uses window before first useEffect.`
      );
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("SSR window check passed.");
