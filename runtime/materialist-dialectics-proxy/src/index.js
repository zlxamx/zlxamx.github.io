const DEFAULT_ALLOWED_ORIGINS = [
  "https://luxi.blog",
  "https://www.luxi.blog",
  "http://localhost:1313",
  "http://127.0.0.1:1313",
];

const API_PATH = "/api/materialist-dialectics/chat";
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_INPUT_LIMIT = 1600;
const DEFAULT_MAX_HISTORY_MESSAGES = 8;
const DEFAULT_MAX_OUTPUT_TOKENS = 900;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 600_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 12;
const RESPONSE_SCHEMA = {
  name: "materialist_dialectics_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["answer", "follow_up", "reject"],
      },
      message: {
        type: "string",
      },
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionType: {
            type: "string",
            enum: [
              "contradiction",
              "ism_error",
              "epistemology",
              "strategy",
              "alignment",
              "execution",
              "out_of_scope",
              "unknown",
            ],
          },
          disclaimer: {
            type: "boolean",
          },
        },
        required: ["questionType", "disclaimer"],
      },
    },
    required: ["status", "message", "meta"],
  },
};
const buckets = new Map();

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

function parseNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
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
  const clientIp = getClientIp(request);

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

  headers.set("Cache-Control", "no-store");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isAllowedOrigin(origin, allowedOrigins) {
  return !origin || allowedOrigins.includes(origin);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStoredMessage(message) {
  if (!isPlainObject(message)) {
    return null;
  }

  const role = ["user", "assistant"].includes(message.role) ? message.role : "";
  const content = typeof message.content === "string" ? message.content.trim() : "";

  if (!role || !content) {
    return null;
  }

  return {
    role,
    kind: typeof message.kind === "string" ? message.kind : "",
    content,
  };
}

function normalizeMessages(messages, maxHistoryMessages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map(normalizeStoredMessage)
    .filter(Boolean)
    .slice(-maxHistoryMessages);
}

function buildModelInput(messages, input) {
  return [
    ...messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    {
      role: "user",
      content: input,
    },
  ];
}

function directPolicyBlock(input) {
  const normalized = input.toLowerCase();

  if (/自杀|轻生|不想活|结束生命|伤害自己|kill myself|suicide|hurt myself/.test(normalized)) {
    return {
      status: "reject",
      message:
        "这类情况不适合继续做抽象分析。现在更重要的是立刻联系你身边可信任的人，并尽快联系当地紧急支持或专业心理援助资源；如果你已经处在马上会伤害自己的边缘，请立刻呼叫当地急救或紧急热线。",
      meta: {
        questionType: "out_of_scope",
        disclaimer: true,
      },
    };
  }

  if (
    /报复|炸|爆破|下毒|投毒|捅|刺杀|暗杀|勒索|诈骗|洗钱|黑产|绕过风控|规避监管|ddos|malware|ransomware/.test(
      normalized,
    )
  ) {
    return {
      status: "reject",
      message:
        "这个请求已经越过了这页的边界。这里不提供伤害、报复、违法规避、骚扰操控或灰黑产相关方案；如果你愿意，可以把问题改成合法、合伦理的处境分析或风险判断问题。",
      meta: {
        questionType: "out_of_scope",
        disclaimer: false,
      },
    };
  }

  return null;
}

function normalizeModelResult(result, sessionId) {
  const fallback = {
    status: "reject",
    message: "服务端暂时没有整理出可交付的响应。请稍后重试。",
    meta: {
      questionType: "unknown",
      disclaimer: false,
      sessionId,
    },
  };

  if (!isPlainObject(result)) {
    return fallback;
  }

  const status = ["answer", "follow_up", "reject"].includes(result.status)
    ? result.status
    : "reject";
  const message = typeof result.message === "string" ? result.message.trim() : "";
  const meta = isPlainObject(result.meta) ? result.meta : {};
  const questionType = [
    "contradiction",
    "ism_error",
    "epistemology",
    "strategy",
    "alignment",
    "execution",
    "out_of_scope",
    "unknown",
  ].includes(meta.questionType)
    ? meta.questionType
    : "unknown";

  if (!message) {
    return fallback;
  }

  return {
    status,
    message,
    meta: {
      questionType,
      disclaimer: Boolean(meta.disclaimer),
      sessionId,
    },
  };
}

function buildSystemPrompt({ followUpAlreadyUsed }) {
  return `
You are the backend runtime for a public page called "Materialist Dialectics".

The page is not a general chat assistant. It only handles analysis-heavy questions such as:
- 怎么看
- 为什么
- 该不该
- 怎么选
- 怎么办
- 如何理解

Your job is to help the user identify the real contradiction, the main issue, the key conditions, and the direction of judgment.

Hard boundaries:
- Do not evaluate living political figures or current leaders.
- Do not provide violent, retaliatory, illegal-evasion, harassment, coercion, or harmful instructions.
- Do not replace medical, legal, financial, or mental-health professionals.
- Do not use dialectics to justify obvious ethical or legal wrongdoing.
- If the question is outside scope, return reject.

Style requirements:
- Default to Simplified Chinese unless the user clearly asks in another language.
- Preserve the method, not theatrical role-play.
- Start with the core judgment, then break the issue apart.
- Use plain text only. No Markdown headings, no code fences, no bullet lists that depend on markdown rendering.
- Keep answers direct and readable for a public webpage.

Reasoning route:
- If the question lacks critical facts and a useful answer would otherwise become generic, ask one round of 3 to 4 concise follow-up questions.
- Follow-up already used in this session: ${followUpAlreadyUsed ? "yes" : "no"}.
- If follow-up already used is "yes", do not ask another follow-up round. Answer with the available information instead.
- If the request is out of scope or crosses a boundary, return reject.
- Otherwise return answer.

Internal categories for meta.questionType:
- contradiction
- ism_error
- epistemology
- strategy
- alignment
- execution
- out_of_scope
- unknown

You must output valid JSON only with this shape:
{
  "status": "answer" | "follow_up" | "reject",
  "message": "plain text response",
  "meta": {
    "questionType": "contradiction" | "ism_error" | "epistemology" | "strategy" | "alignment" | "execution" | "out_of_scope" | "unknown",
    "disclaimer": true | false
  }
}

When disclaimer should be true:
- career / breakup / family / relocation / money / health / legal / finance / mental-health decisions
- any answer that could be mistaken for professional or life-defining advice

When status is follow_up:
- message must contain only the 3 to 4 questions
- do not start analysis yet

When status is reject:
- explain the boundary briefly
- redirect the user toward a safer or more analyzable reformulation when possible
`.trim();
}

function parseJsonText(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      return null;
    }

    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch (nestedError) {
      return null;
    }
  }
}

function extractOpenAIOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  if (!Array.isArray(payload.output)) {
    return "";
  }

  const parts = [];

  payload.output.forEach((item) => {
    if (!Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem.type === "output_text" && typeof contentItem.text === "string") {
        parts.push(contentItem.text);
      }
    });
  });

  return parts.join("").trim();
}

function extractOpenAIRefusalText(payload) {
  if (!Array.isArray(payload.output)) {
    return "";
  }

  const parts = [];

  payload.output.forEach((item) => {
    if (!Array.isArray(item.content)) {
      return;
    }

    item.content.forEach((contentItem) => {
      if (contentItem.type === "refusal" && typeof contentItem.refusal === "string") {
        parts.push(contentItem.refusal);
      }
    });
  });

  return parts.join("\n").trim();
}

function normalizeDeepSeekMessages(instructions, input) {
  return [
    {
      role: "system",
      content: `${instructions}\n\nReturn valid JSON only.`,
    },
    ...input,
  ];
}

function resolveProviderConfig(env) {
  const rawProvider = (env.LLM_PROVIDER || "").trim().toLowerCase();
  const provider = rawProvider || (env.DEEPSEEK_API_KEY ? "deepseek" : "openai");

  if (provider === "deepseek") {
    return {
      provider,
      apiKey: env.DEEPSEEK_API_KEY || "",
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    };
  }

  return {
    provider: "openai",
    apiKey: env.OPENAI_API_KEY || "",
    model: env.OPENAI_MODEL || "gpt-5.4-mini",
    baseUrl: env.OPENAI_BASE_URL || "https://api.openai.com",
  };
}

async function callOpenAI({ apiKey, model, baseUrl, instructions, input, maxOutputTokens, safetyIdentifier, timeoutMs }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      prompt_cache_key: "materialist-dialectics-v1",
      safety_identifier: safetyIdentifier,
      text: {
        format: {
          type: "json_schema",
          json_schema: RESPONSE_SCHEMA,
        },
      },
    }),
    signal: createTimeoutSignal(timeoutMs),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "OpenAI request failed");
  }

  const outputText = extractOpenAIOutputText(payload);
  const parsed = parseJsonText(outputText);
  const refusalText = extractOpenAIRefusalText(payload);

  if (parsed) {
    return parsed;
  }

  if (refusalText) {
    return {
      status: "reject",
      message: refusalText,
      meta: {
        questionType: "out_of_scope",
        disclaimer: false,
      },
    };
  }

  throw new Error(`OpenAI returned non-JSON output: ${outputText || "[empty]"}`);
}

async function callDeepSeek({ apiKey, model, baseUrl, instructions, input, maxOutputTokens, timeoutMs }) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: normalizeDeepSeekMessages(instructions, input),
      temperature: 0.2,
      max_tokens: maxOutputTokens,
      response_format: {
        type: "json_object",
      },
      stream: false,
    }),
    signal: createTimeoutSignal(timeoutMs),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "DeepSeek request failed");
  }

  const text = payload?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonText(text);

  if (parsed) {
    return parsed;
  }

  throw new Error(`DeepSeek returned non-JSON output: ${text || "[empty]"}`);
}

async function callModel({ config, instructions, input, maxOutputTokens, safetyIdentifier, timeoutMs }) {
  if (config.provider === "deepseek") {
    return callDeepSeek({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      instructions,
      input,
      maxOutputTokens,
      timeoutMs,
    });
  }

  return callOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    instructions,
    input,
    maxOutputTokens,
    safetyIdentifier,
    timeoutMs,
  });
}

function getClientIp(request) {
  const forwarded = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
  if (forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return "unknown-client";
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

async function buildSafetyIdentifier(clientIp) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(clientIp || "unknown-client"));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hasDirectProvider(env) {
  return Boolean((env.DEEPSEEK_API_KEY || "").trim() || (env.OPENAI_API_KEY || "").trim());
}

async function handleDirectRuntime(request, env, origin, allowedOrigins) {
  let body;

  try {
    body = await request.json();
  } catch (error) {
    return json(
      400,
      {
        error: {
          code: "invalid_payload",
          message: "Request body must be valid JSON.",
        },
      },
      origin,
      allowedOrigins,
    );
  }

  if (!isPlainObject(body)) {
    return json(
      400,
      {
        error: {
          code: "invalid_payload",
          message: "Request body must be valid JSON.",
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const page = typeof body.page === "string" ? body.page.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (page !== "materialist-dialectics" || !sessionId || !input) {
    return json(
      400,
      {
        error: {
          code: "invalid_payload",
          message: "page, sessionId, and input are required.",
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const inputLimit = parseNumber(env.INPUT_LIMIT, DEFAULT_INPUT_LIMIT);
  if (input.length > inputLimit) {
    return json(
      400,
      {
        error: {
          code: "input_too_long",
          message: `Input must be ${inputLimit} characters or fewer.`,
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const clientIp = getClientIp(request);
  const rateLimit = checkRateLimit({
    key: clientIp,
    windowMs: parseNumber(env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
    limit: parseNumber(env.RATE_LIMIT_MAX_REQUESTS, DEFAULT_RATE_LIMIT_MAX_REQUESTS),
  });

  if (!rateLimit.allowed) {
    return json(
      429,
      {
        error: {
          code: "rate_limited",
          message: "Too many requests from this client. Please retry later.",
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const policyBlocked = directPolicyBlock(input);
  if (policyBlocked) {
    return json(
      200,
      {
        ...policyBlocked,
        meta: {
          ...policyBlocked.meta,
          sessionId,
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const providerConfig = resolveProviderConfig(env);
  if (!providerConfig.apiKey) {
    return json(
      503,
      {
        error: {
          code: "runtime_not_configured",
          message:
            providerConfig.provider === "deepseek"
              ? "DEEPSEEK_API_KEY is missing on the server."
              : "OPENAI_API_KEY is missing on the server.",
        },
      },
      origin,
      allowedOrigins,
    );
  }

  const maxHistoryMessages = parseNumber(env.MAX_HISTORY_MESSAGES, DEFAULT_MAX_HISTORY_MESSAGES);
  const messages = normalizeMessages(body.messages, maxHistoryMessages);
  const followUpAlreadyUsed = messages.some((message) => message.kind === "follow_up");

  try {
    const result = await callModel({
      config: providerConfig,
      instructions: buildSystemPrompt({ followUpAlreadyUsed }),
      input: buildModelInput(messages, input),
      maxOutputTokens: parseNumber(env.MAX_OUTPUT_TOKENS, DEFAULT_MAX_OUTPUT_TOKENS),
      safetyIdentifier: await buildSafetyIdentifier(clientIp),
      timeoutMs: parseTimeoutMs(env.REQUEST_TIMEOUT_MS),
    });

    return json(200, normalizeModelResult(result, sessionId), origin, allowedOrigins);
  } catch (error) {
    return json(
      500,
      {
        error: {
          code: "model_call_failed",
          message: "The model runtime failed to produce a valid response.",
        },
      },
      origin,
      allowedOrigins,
    );
  }
}

async function handleUpstreamProxy(request, env, origin, allowedOrigins) {
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

  const requestBody = await request.arrayBuffer();

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: "POST",
      headers: cloneUpstreamHeaders(request),
      body: requestBody,
      redirect: "manual",
      signal: createTimeoutSignal(parseTimeoutMs(env.REQUEST_TIMEOUT_MS)),
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

    if (hasDirectProvider(env)) {
      return handleDirectRuntime(request, env, origin, allowedOrigins);
    }

    return handleUpstreamProxy(request, env, origin, allowedOrigins);
  },
};
