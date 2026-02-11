const fs = require("fs");
const path = require("path");

const files = [
  "components/OverlayWindowControls.tsx",
  "components/OverlayHeaderControls.tsx",
  "components/OverlayModal.tsx",
  "components/OverlayUpdateModal.tsx",
  "components/OverlayHeader.tsx",
].map((file) => path.join(__dirname, "..", file));

const checks = [
  { token: "bg-ink", pattern: /\bbg-ink\b|\bbg-ink\// },
  { token: "border-white", pattern: /\bborder-white\b|\bborder-white\// },
  { token: "text-white", pattern: /\btext-white\b|\btext-white\// },
  { token: "text-black", pattern: /\btext-black\b|\btext-black\// },
  { token: "bg-white", pattern: /\bbg-white\b|\bbg-white\// },
  { token: "border-gray-200", pattern: /\bborder-gray-200\b/ },
  { token: "text-slate-900", pattern: /\btext-slate-900\b/ },
  { token: "bg-slate-100/200/300", pattern: /\bbg-slate-(100|200|300)\b/ },
  { token: "bg-gray-100/200", pattern: /\bbg-gray-(100|200)\b/ },
  { token: "bg-neutral-100/200", pattern: /\bbg-neutral-(100|200)\b/ },
  { token: "variant=secondary", pattern: /variant\s*=\s*["']secondary["']/ },
  { token: "variant=outline", pattern: /variant\s*=\s*["']outline["']/ },
];

let failed = false;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    for (const check of checks) {
      if (check.pattern.test(line)) {
        console.error(
          `Overlay theme check failed: ${file}:${i + 1} contains ${check.token}`
        );
        failed = true;
      }
    }
  }
}

if (failed) {
  process.exit(1);
}

console.log("Overlay theme check passed.");
