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

function extractRefusalText(payload) {
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

    const outputText = extractOutputText(payload);
    const parsed = parseJsonText(outputText);
    const refusalText = extractRefusalText(payload);

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

module.exports = {
  callOpenAI,
};
