const DEFAULT_ALLOWED_ORIGINS = [
  "https://luxi.blog",
  "https://www.luxi.blog",
  "http://localhost:1313",
  "http://127.0.0.1:1313",
];

function parseAllowedOrigins(env = process.env) {
  const merged = [
    env.ALLOWED_ORIGINS || "",
    env.ALLOWED_ORIGIN || "",
  ]
    .join(",")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const origins = merged.length ? merged : DEFAULT_ALLOWED_ORIGINS;
  return Array.from(new Set(origins));
}

function sendCors(req, res) {
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
  const allowedOrigins = parseAllowedOrigins(process.env);
  const origin = requestOrigin && allowedOrigins.includes(requestOrigin) ? requestOrigin : "";

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function json(res, statusCode, payload) {
  res.status(statusCode).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }

  if (!chunks.length) {
    return null;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    return null;
  }
}

module.exports = {
  json,
  parseAllowedOrigins,
  readJsonBody,
  sendCors,
};
