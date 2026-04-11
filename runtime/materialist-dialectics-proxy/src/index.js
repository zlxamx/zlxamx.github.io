const DEFAULT_ALLOWED_ORIGINS = [
  "https://luxi.blog",
  "https://www.luxi.blog",
  "http://localhost:1313",
  "http://127.0.0.1:1313",
];

const API_PATH = "/api/materialist-dialectics/chat";
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;

function parseAllowedOrigins(value) {
  if (typeof value !== "string" || !value.trim()) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  );
}

function createCorsHeaders(origin, allowedOrigins) {
  const headers = new Headers();

  if (origin && allowedOrigins.includes(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }

  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Cache-Control", "no-store");
  return headers;
}

function json(status, payload, origin, allowedOrigins) {
  const headers = createCorsHeaders(origin, allowedOrigins);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

function parseTimeoutMs(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

function createTimeoutSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  return undefined;
}

function resolveUpstreamUrl(env) {
  const raw = typeof env.UPSTREAM_URL === "string" ? env.UPSTREAM_URL.trim() : "";
  if (!raw) {
    return null;
  }

  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol)) {
      return null;
    }

    return url;
  } catch (error) {
    return null;
  }
}

function cloneUpstreamHeaders(request) {
  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const clientIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    "";

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (clientIp) {
    headers.set("x-forwarded-for", clientIp);
  }

  return headers;
}

function withCors(response, origin, allowedOrigins) {
  const headers = new Headers(response.headers);
  const corsHeaders = createCorsHeaders(origin, allowedOrigins);

  corsHeaders.forEach((value, key) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin")?.trim() || "";
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);

    if (url.pathname !== API_PATH) {
      return new Response("Not Found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(origin, allowedOrigins),
      });
    }

    if (request.method !== "POST") {
      return json(
        405,
        {
          error: {
            code: "method_not_allowed",
            message: "Only POST is allowed.",
          },
        },
        origin,
        allowedOrigins,
      );
    }

    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return json(
        403,
        {
          error: {
            code: "forbidden_origin",
            message: "Origin is not allowed.",
          },
        },
        origin,
        allowedOrigins,
      );
    }

    const upstreamUrl = resolveUpstreamUrl(env);
    if (!upstreamUrl) {
      return json(
        503,
        {
          error: {
            code: "proxy_not_configured",
            message: "UPSTREAM_URL is missing or invalid.",
          },
        },
        origin,
        allowedOrigins,
      );
    }

    const timeoutMs = parseTimeoutMs(env.REQUEST_TIMEOUT_MS);
    const requestBody = await request.arrayBuffer();

    try {
      const upstreamResponse = await fetch(upstreamUrl.toString(), {
        method: "POST",
        headers: cloneUpstreamHeaders(request),
        body: requestBody,
        redirect: "manual",
        signal: createTimeoutSignal(timeoutMs),
      });
      return withCors(upstreamResponse, origin, allowedOrigins);
    } catch (error) {
      const code = error?.name === "TimeoutError" ? "upstream_timeout" : "upstream_unavailable";
      const status = error?.name === "TimeoutError" ? 504 : 502;

      return json(
        status,
        {
          error: {
            code,
            message: "The upstream runtime is unavailable.",
          },
        },
        origin,
        allowedOrigins,
      );
    }
  },
};
