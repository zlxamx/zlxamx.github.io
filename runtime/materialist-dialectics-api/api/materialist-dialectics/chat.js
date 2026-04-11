const { createHash } = require("node:crypto");
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

function buildSafetyIdentifier(clientIp) {
  return createHash("sha256").update(clientIp || "unknown-client").digest("hex");
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

module.exports = async function handler(req, res) {
  sendCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
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
      safetyIdentifier: buildSafetyIdentifier(clientIp),
    });

    json(res, 200, normalizeModelResult(result, sessionId));
  } catch (error) {
    json(res, 500, {
      error: {
        code: "model_call_failed",
        message: error instanceof Error
          ? error.message
          : "The model runtime failed to produce a valid response.",
      },
    });
  }
};
