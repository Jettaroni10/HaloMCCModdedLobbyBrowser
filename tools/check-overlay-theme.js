const fs = require("fs");
const path = require("path");

const files = [
  "components/OverlayWindowControls.tsx",
  "components/OverlayHeaderControls.tsx",
  "components/OverlayModal.tsx",
  "components/OverlayUpdateModal.tsx",
].map((file) => path.join(__dirname, "..", file));

const checks = [
  { pattern: /\bbg-ink\b|\bbg-ink\//, message: "Avoid bg-ink (light) in overlay UI." },
  { pattern: /\btext-white\b|\btext-white\//, message: "Avoid text-white in overlay UI." },
  { pattern: /\bborder-white\b|\bborder-white\//, message: "Avoid border-white in overlay UI." },
];

let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  for (const check of checks) {
    if (check.pattern.test(content)) {
      console.error(`Overlay theme check failed in ${file}: ${check.message}`);
      failed = true;
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Overlay theme check passed.");
