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

function resolveProviderConfig(env) {
  return {
    provider: "deepseek",
    apiKey: env.DEEPSEEK_API_KEY || "",
    model: env.DEEPSEEK_MODEL || "deepseek-chat",
    baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  };
}

async function callDeepSeek({ apiKey, model, baseUrl, instructions, input, maxOutputTokens, timeoutMs = 50000 }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${instructions}\n\nReturn valid JSON only.`,
          },
          ...input,
        ],
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

async function callModel({ config, instructions, input, maxOutputTokens, timeoutMs }) {
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

module.exports = {
  callModel,
  resolveProviderConfig,
};
