const { buildSystemPrompt } = require("../../lib/prompt");
const { checkRateLimit, getClientIp } = require("../../lib/rate-limit");
const { json, sendCors, readJsonBody } = require("../../lib/http");
const { callModel, resolveProviderConfig } = require("../../lib/openai");

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMessages(messages, maxHistoryMessages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .filter((message) => isPlainObject(message))
    .filter((message) => ["user", "assistant"].includes(message.role))
    .filter((message) => typeof message.content === "string" && message.content.trim())
    .slice(-maxHistoryMessages)
    .map((message) => ({
      role: message.role,
      kind: typeof message.kind === "string" ? message.kind : "",
      content: message.content.trim(),
    }));
}

function buildModelInput(messages, input) {
  const history = messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  history.push({
    role: "user",
    content: input,
  });

  return history;
}

function directPolicyBlock(input) {
  const normalized = input.toLowerCase();

  const selfHarmPattern =
    /自杀|轻生|不想活|结束生命|伤害自己|kill myself|suicide|hurt myself/;
  if (selfHarmPattern.test(normalized)) {
    return {
      status: "reject",
      message:
        "这类情况不适合继续做抽象分析。现在更重要的是立刻联系你身边可信任的人，并尽快联系当地紧急支持或专业心理援助资源；如果你已经处在马上会伤害自己的边缘，请立刻呼叫当地急救或紧急热线。",
      meta: {
        questionType: "out_of_scope",
        disclaimer: true,
        analysisPaths: [],
      },
    };
  }

  const violencePattern =
    /报复|炸|爆破|下毒|投毒|捅|刺杀|暗杀|勒索|诈骗|洗钱|黑产|绕过风控|规避监管|ddos|malware|ransomware/;
  if (violencePattern.test(normalized)) {
    return {
      status: "reject",
      message:
        "这个请求已经越过了这页的边界。这里不提供伤害、报复、违法规避、骚扰操控或灰黑产相关方案；如果你愿意，可以把问题改成合法、合伦理的处境分析或风险判断问题。",
      meta: {
        questionType: "out_of_scope",
        disclaimer: false,
        analysisPaths: [],
      },
    };
  }

  return null;
}

const ANALYSIS_PATH_ENUM = [
  "contradiction_analysis",
  "concrete_analysis",
  "primary_secondary",
  "quantity_quality",
  "practice_test",
  "internal_external",
];

const ANALYSIS_PATH_SOURCE_ENUM = ["user", "assistant"];

function collapseForMatch(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, "");
}

function isQuoteGrounded(quote, source, userInput, assistantMessage) {
  const hay = source === "user" ? userInput : assistantMessage;
  const needle = collapseForMatch(quote);
  const haystack = collapseForMatch(hay);
  if (!needle || !haystack) return false;
  return haystack.includes(needle);
}

function normalizeAnalysisPaths(raw, userInput, assistantMessage) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenKeys = new Set();
  const out = [];

  raw.forEach((entry) => {
    if (!isPlainObject(entry)) return;

    const key = ANALYSIS_PATH_ENUM.includes(entry.key) ? entry.key : null;
    const quote = typeof entry.quote === "string" ? entry.quote.trim() : "";
    const source = ANALYSIS_PATH_SOURCE_ENUM.includes(entry.source) ? entry.source : null;
    const explanation = typeof entry.explanation === "string" ? entry.explanation.trim() : "";

    if (!key || !quote || !source || !explanation) return;
    if (seenKeys.has(key)) return;
    if (!isQuoteGrounded(quote, source, userInput, assistantMessage)) return;

    seenKeys.add(key);
    out.push({ key, quote, source, explanation });
  });

  return out.slice(0, 4);
}

const DISCLAIMER_TEXT =
  "以下分析仅供参考，最终决定要由你根据完整处境来做；专业问题请咨询对应专业人士。";

function normalizeModelResult(result, sessionId, userInput = "") {
  const fallback = {
    status: "reject",
    message: "服务端暂时没有整理出可交付的响应。请稍后重试。",
    meta: {
      questionType: "unknown",
      disclaimer: false,
      analysisPaths: [],
      sessionId,
    },
  };

  if (!isPlainObject(result)) {
    return fallback;
  }

  const status = ["answer", "follow_up", "reject"].includes(result.status)
    ? result.status
    : "reject";
  const rawMessage = typeof result.message === "string" ? result.message.trim() : "";
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

  if (!rawMessage) {
    return fallback;
  }

  const disclaimer = Boolean(meta.disclaimer);

  // SKILL: analysisPaths must be empty for non-answer statuses
  const analysisPaths =
    status === "answer"
      ? normalizeAnalysisPaths(meta.analysisPaths, userInput, rawMessage)
      : [];

  // SKILL: append disclaimer text when disclaimer=true and status=answer
  const message =
    disclaimer && status === "answer" && !rawMessage.includes(DISCLAIMER_TEXT)
      ? `${rawMessage}\n\n${DISCLAIMER_TEXT}`
      : rawMessage;

  return {
    status,
    message,
    meta: {
      questionType,
      disclaimer,
      analysisPaths,
      sessionId,
    },
  };
}

module.exports = async function handler(req, res) {
  sendCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  // 层间鉴权：若 INTERNAL_TOKEN 已配置，则拒绝不携带正确 token 的请求
  const internalToken = process.env.INTERNAL_TOKEN || "";
  if (internalToken) {
    const provided = typeof req.headers["x-internal-token"] === "string"
      ? req.headers["x-internal-token"]
      : "";
    if (provided !== internalToken) {
      json(res, 403, {
        error: {
          code: "forbidden",
          message: "Forbidden.",
        },
      });
      return;
    }
  }

  if (req.method !== "POST") {
    json(res, 405, {
      error: {
        code: "method_not_allowed",
        message: "Only POST is allowed.",
      },
    });
    return;
  }

  const body = await readJsonBody(req);
  if (!isPlainObject(body)) {
    json(res, 400, {
      error: {
        code: "invalid_payload",
        message: "Request body must be valid JSON.",
      },
    });
    return;
  }

  const page = typeof body.page === "string" ? body.page.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";

  if (page !== "materialist-dialectics" || !sessionId || !input) {
    json(res, 400, {
      error: {
        code: "invalid_payload",
        message: "page, sessionId, and input are required.",
      },
    });
    return;
  }

  const inputLimit = Number(process.env.INPUT_LIMIT || "1600");
  if (input.length > inputLimit) {
    json(res, 400, {
      error: {
        code: "input_too_long",
        message: `Input must be ${inputLimit} characters or fewer.`,
      },
    });
    return;
  }

  const clientIp = getClientIp(req);
  const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || "600000");
  const maxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS || "12");
  const rateLimit = checkRateLimit({
    key: clientIp,
    windowMs,
    limit: maxRequests,
  });

  if (!rateLimit.allowed) {
    json(res, 429, {
      error: {
        code: "rate_limited",
        message: "Too many requests from this client. Please retry later.",
      },
    });
    return;
  }

  const policyBlocked = directPolicyBlock(input);
  if (policyBlocked) {
    json(res, 200, {
      ...policyBlocked,
      meta: {
        ...policyBlocked.meta,
        sessionId,
      },
    });
    return;
  }

  const providerConfig = resolveProviderConfig(process.env);
  if (!providerConfig.apiKey) {
    json(res, 503, {
      error: {
        code: "runtime_not_configured",
        message:
          providerConfig.provider === "deepseek"
            ? "DEEPSEEK_API_KEY is missing on the server."
            : "OPENAI_API_KEY is missing on the server.",
      },
    });
    return;
  }

  const maxHistoryMessages = Number(process.env.MAX_HISTORY_MESSAGES || "8");
  const messages = normalizeMessages(body.messages, maxHistoryMessages);
  const followUpAlreadyUsed = messages.some((message) => message.kind === "follow_up");

  try {
    const result = await callModel({
      config: providerConfig,
      instructions: buildSystemPrompt({ followUpAlreadyUsed }),
      input: buildModelInput(messages, input),
      maxOutputTokens: Number(process.env.MAX_OUTPUT_TOKENS || "900"),
      timeoutMs: Number(process.env.MODEL_TIMEOUT_MS || "50000"),
    });

    json(res, 200, normalizeModelResult(result, sessionId, input));
  } catch (error) {
    json(res, 500, {
      error: {
        code: "model_call_failed",
        message: "The model runtime failed to produce a valid response.",
      },
    });
  }
};
