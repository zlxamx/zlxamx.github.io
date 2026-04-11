function extractOutputText(payload) {
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

function parseJsonText(text) {
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
            type: "json_object",
          },
        },
      }),
      signal: controller.signal,
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error?.message || "OpenAI request failed");
    }

    const outputText = extractOutputText(payload);
    const parsed = parseJsonText(outputText);

    if (!parsed) {
      throw new Error("OpenAI returned non-JSON output");
    }

    return parsed;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  callOpenAI,
};
