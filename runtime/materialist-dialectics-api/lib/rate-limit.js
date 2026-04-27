const buckets = new Map();

function getClientIp(req) {
  // x-real-ip: Vercel 原生注入，不可由客户端伪造，优先使用
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim();
  }

  // x-forwarded-for 兜底：取 CF Worker 转发过来的第一段（真实客户端 IP）
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
