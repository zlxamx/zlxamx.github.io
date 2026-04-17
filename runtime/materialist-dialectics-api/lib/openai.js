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
          analysisPaths: {
            type: "array",
            items: {
              type: "string",
              enum: [
                "contradiction_analysis",
                "concrete_analysis",
                "primary_secondary",
                "quantity_quality",
                "practice_test",
                "internal_external",
              ],
            },
          },
        },
        required: ["questionType", "disclaimer", "analysisPaths"],
      },
    },
    required: ["status", "message", "meta"],
  },
};

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
    baseUrl: "https://api.openai.com",
  };
}

async function callOpenAI({ apiKey, model, instructions, input, maxOutputTokens, safetyIdentifier }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
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
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

async function callDeepSeek({ apiKey, model, baseUrl, instructions, input, maxOutputTokens }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
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
      signal: controller.signal,
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
  } finally {
    clearTimeout(timeout);
  }
}

async function callModel({ config, instructions, input, maxOutputTokens, safetyIdentifier }) {
  if (config.provider === "deepseek") {
    return callDeepSeek({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      instructions,
      input,
      maxOutputTokens,
    });
  }

  return callOpenAI({
    apiKey: config.apiKey,
    model: config.model,
    instructions,
    input,
    maxOutputTokens,
    safetyIdentifier,
  });
}

module.exports = {
  callModel,
  resolveProviderConfig,
};
