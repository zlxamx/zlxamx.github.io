const buckets = new Map();

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown-client";
}

function checkRateLimit({ key, windowMs, limit }) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.startedAt >= windowMs) {
    buckets.set(key, {
      startedAt: now,
      count: 1,
    });

    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return { allowed: false };
  }

  bucket.count += 1;
  return { allowed: true };
}

module.exports = {
  checkRateLimit,
  getClientIp,
};
