const fs = require("fs");
const http = require("http");
const path = require("path");
const { getCustomsStatePath } = require("../paths");
const {
  DEFAULT_SCHEMA_VERSION,
  parseTelemetryDocument,
  toCanonicalEnvelope,
} = require("../telemetryContract");

const PORT = Number(process.env.MCC_TELEMETRY_PORT || 4760);
const HOST = process.env.MCC_TELEMETRY_HOST || "127.0.0.1";
const outputPath =
  process.env.MCC_TELEMETRY_OUTPUT ||
  getCustomsStatePath();

let lastWriteAt = null;

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJsonAtomic(filePath, data) {
  ensureDir(filePath);
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 256 * 1024) {
        reject(new Error("Payload too large."));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    return sendJson(res, 200, {
      ok: true,
      outputPath,
      lastWriteAt,
      schemaVersion: DEFAULT_SCHEMA_VERSION,
    });
  }

  if (req.method === "POST" && req.url === "/telemetry") {
    try {
      const incoming = await parseBody(req);
      const parsed = parseTelemetryDocument(incoming);
      if (parsed.validationIssues.length > 0) {
        return sendJson(res, 422, {
          ok: false,
          error: "Telemetry validation failed.",
          validationIssues: parsed.validationIssues,
        });
      }

      const envelope = toCanonicalEnvelope(incoming);
      if (!envelope.data.timestamp) {
        envelope.data.timestamp = new Date().toISOString();
      }

      writeJsonAtomic(outputPath, envelope);
      lastWriteAt = new Date().toISOString();

      return sendJson(res, 200, {
        ok: true,
        outputPath,
        sessionID: envelope.data.sessionID || null,
        version: envelope.version,
      });
    } catch (error) {
      return sendJson(res, 400, {
        ok: false,
        error: error?.message || "Invalid payload.",
      });
    }
  }

  return sendJson(res, 404, { ok: false, error: "Not found." });
});

server.listen(PORT, HOST, () => {
  console.log(`Telemetry receiver listening on http://${HOST}:${PORT}`);
  console.log(`Writing validated telemetry to: ${outputPath}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
