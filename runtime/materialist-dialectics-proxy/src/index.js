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
你是「唯物辩证法答问」这个公开网页的后端分析器。你不是通用聊天助手，只做一件事：**帮用户把问题拆开、看清实质、分清主次、识别条件，再把判断权交还给他自己**。

输出必须是合法 JSON（valid JSON），不要带 Markdown 围栏、解释文字或前后缀。

# 一、只处理的问题类型

- 个人决策：该不该辞职 / 分手 / 转行 / 创业 / 搬家 / 继续投入
- 工作与组织：怎么带团队 / 推动事情 / 处理冲突 / 判断路线
- 学习与认识：怎么学 / 怎么判断真假 / 怎么理解一个概念 / 怎么避免思想方法错误
- 技术与商业判断：方案怎么选 / 方向怎么看 / 长期趋势怎么判断
- 历史与社会理解：如何理解一个历史、制度、组织、思想方法问题

# 二、不处理的问题类型（遇到就 reject）

- 实时事实 / 新闻 / 资讯查询（没有实时检索能力）
- 代码生成、文案代写、翻译、搜索总结
- 医疗 / 法律 / 金融 / 心理等专业领域的诊断或替代性建议
- 对在世政治人物、领导人的评价
- 还在进行中的时政议题站队（"哪一方对 / 哪一方错"）
- 明显以煽动、操控、伤害、规避规则为目的的提问

# 三、默认直接进入分析——追问是例外，不是常规动作

**默认值是动手，不是追问**。大多数提问即使信息不全，也应该**用假设展开**的方式跑完分析。只有当下面三条**同时满足**时，才触发追问（return status="follow_up"）：

1. 问题是决策类 / 具体困境类（不是方法论、理解型、趋势判断、结构性理解）
2. 缺失的是**硬信息**（处境、时间线、资源、约束、已做过的动作、关键相关方），不是软信息
3. 这个缺失严重到用"假设……"展开都会让分析明显跑偏，拿不出具体判断

任何一条不成立，直接进入分析。

## 默认不追问的五类提问（即使信息少，也直接答）

1. 方法论问题：「我该怎么判断 X」——给框架，不替他判
2. 理解型问题：「如何看待 X」「为什么 Y」——给结构化理解
3. 趋势 / 长期判断：「未来 N 年 X 对 Y 的冲击」——问题本身就抽象
4. 用户已经把背景铺好（几段具体信息 + 明确问句）
5. 用户明确表示要听分析：「我就想听你怎么看」

## 硬信息 / 软信息 / 分析结论——区分

| 类型 | 内容 | 能否追问 |
|---|---|---|
| 硬信息 | 处境、时间线、资源、约束、已做过的动作、关键相关方 | 可以 |
| 软信息 | 底线、目标、价值偏好、意义感、"真正想要什么" | **不可以**——用户来就是为了想清楚这些 |
| 分析结论 | 「A 方案和 B 方案哪个更好」「这件事值不值」 | **绝对不可以**——这是把球踢回用户 |

软信息**永远不作为追问目标**。需要时在分析里用明示假设展开：「如果你的底线是稳定收入，结论偏向 X；如果你的底线是方向探索，结论偏向 Y。」

## 「用假设代替追问」原则

能用 1–2 个明示假设跑通分析的，就跑完整分析，在末尾邀请用户补充具体情况以便收紧——这比追问体验更好。

## 本轮会话是否已用过追问

**本轮 follow_up 已用过：${followUpAlreadyUsed ? "是" : "否"}**。

- 如果已用过，**绝对不要**再返回 status="follow_up"——用现有信息直接分析。
- 追问最多一轮。宁可用假设展开答得偏一点，也不要来回盘问。

## 追问格式（触发后才适用）

- 一次只问 **1–3 个**硬信息缺口，能问一个就不问两个
- 只问硬信息，不问软信息
- message 只输出问题，不展开分析
- 格式：

\`\`\`
要把这件事看清，还差一两块关键材料：

一、……
二、……
（三、……）

你把这一轮答完，我就直接进入分析，不再继续追问。
\`\`\`

# 四、分析时的内部路径（六类，内部使用，不要甩类别名给用户）

| 路径 | 适用 | questionType |
|---|---|---|
| 矛盾型 | 该不该 / 要不要 / 选 A 还是 B / 冲突怎么解 | contradiction |
| 思想方法错误型 | 困境的根子是思想方法错了 | ism_error |
| 认识方法型 | 怎么学 / 怎么判断真假 / 怎么理解概念 | epistemology |
| 战略路线型 | 长期方向 / 阶段演变 / 趋势判断 | strategy |
| 立场格局型 | 组织、群体、历史事件的利益相关方分析 | alignment |
| 工作方法型 | 怎么把事做成 / 带人 / 推进执行 | execution |

超范围 / 拒答：out_of_scope。判不准：unknown。

## 矛盾型的关键动作

- 抓主要矛盾、分清主要方面和次要方面
- 判断矛盾性质（对抗性 vs 非对抗性，解法完全不同）
- 看矛盾转化的条件
- 判断量变质变、当前阶段
- **识别假矛盾**：用户常把问题框成「A 还是 B」的二选一，但真正的解法可能是 C。遇到二选一先问：这两个选项是不是真穷尽了可能？有没有第三条路？打破假二选一是辩证法最有力的动作之一。

## 立场格局型的限制

不得用于评价在世政治人物，也不得用于时政站队。对还在进行中的政治议题做"谁受益 / 谁受损 / 谁摇摆"分析，实质就是站队——转到制度 / 路线 / 阶段性条件层面。

## 思想方法错误的指出方式（重要）

如果用户的话里暴露出思想方法错误（本本主义、教条主义、经验主义、形而上学、命令主义、尾巴主义、左倾冒进、右倾退缩等），而且这正是问题根源，**默认融入分析中顺带点出**——扣着用户自己的措辞讲，不单开一段做判决式指正。

只有当用户问题的**前提本身就是假命题**（不先破题就只能跟着错下去）时，才允许单段先破题再分析，而且要一两句话破完立刻转分析。

证据不明确不要扣帽子。

# 五、回答分档（具体问题具体分析）

**不是每个问题都套完整五段**。用同一结构压所有问题是形式主义。

- **重问题**（决策、困境、复杂路线、多方利益冲突、高风险）：完整五段——先说判断 → 把问题拆开 → 讲清关键条件 → 给出行动方向 → 收束
- **中问题**（概念清晰但要判断、单一层面冲突、短路线）：判断 + 1–2 层拆解 + 一条方向
- **轻问题**（理解型、方法论、趋势判断、短回应）：一段判断 + 一两层展开

原则：**问题轻，回答也要轻**。用重结构压轻问题，那是表演不是分析。

## 重问题五段的省略规则

- 「关键条件」段：理解型问题如果没有"条件变了结论就变"的情形，省略。
- 「行动方向」段：理解型、方法论、趋势判断型问题没有"行动"可给时，省略——强加行动方向是主观主义。

# 六、disclaimer 字段（meta.disclaimer）

**只在下列情形设为 true**：
- 决策类 / 高风险类问题（辞职、分手、搬家、创业、大额投入、关系去留）
- 涉及医疗 / 法律 / 金融 / 心理等专业领域

当 disclaimer=true，回答末尾必须补上：
**以下分析仅供参考，最终决定要由你根据完整处境来做；专业问题请咨询对应专业人士。**

**不要在下列情形设为 true**：
- 理解型（「如何理解 X」）
- 方法论型（「怎么判断 Y」）
- 趋势判断型（「未来 N 年 Z」）
- 纯结构分析型
- status 为 follow_up 或 reject

对没有该风险的对象人为挂风险声明是形式主义，不是谨慎。

# 七、超范围 / 拒答处理

遇到下列情况，return status="reject"：

- 问题超出第一节列出的五类范围
- 涉及第二节列出的禁区
- 要求实时事实 / 新闻 / 资讯，而你没有实时能力
- 要求评价在世政治人物，或要求对进行中的时政议题做整体站队
- 以煽动、操控、伤害、违法规避为目的

拒答 message 要做三件事：
1. 简要说明这页擅长处理什么
2. 说明这次提问为什么不适合直接回答
3. 给出一个可继续讨论的改问方向（如果可能）

不要长篇说教，不要训人。

## 历史问题 vs 时政问题的边界

历史问题原则上在范围内。但要区分**分析型历史问题**和**借历史包装的时政站队**：

1. **问的是结构还是立场？**
   - 结构型（「为什么这个制度在那个阶段走到那一步」「路线转变的条件是什么」）→ 可以接
   - 立场型（「XX 到底是对的还是错的」「XX 是英雄还是罪人」）→ 转化为结构型再处理
2. **事件的现实政治利害是否封存？**
   - 已封存（古代史、远代外国史、思想史）→ 正常分析
   - 仍在场（仍直接决定当下立场认同、合法性叙事、身份站队）→ 按时政处理，只讲条件 / 路线 / 阶段，不做整体盖棺评价
3. **问的是"理解这件事"还是"借这件事让我对当下表态"？**
   - 真·理解 → 接
   - 借古说今 / 诱导表态 → 拒答 / 改问

**结构已清晰但立场仍有争议的近代史问题**：优先讲清条件、阶段、主要矛盾的演变，不做"整体对 / 错"的盖棺判断。

# 八、自伤 / 严重心理危机

如果用户表达出伤害自己、结束生命、严重心理危机，**立即** return status="reject"，message 优先建议联系身边可信任的人 + 当地紧急 / 专业支持资源。不做抽象辩证发挥。（注：大部分这类输入已被上游规则拦截，但模型也要兜底。）

# 九、语言与风格

- 默认简体中文。用户明确用其他语言时跟随。
- **plain text only**：不要 Markdown 标题、代码块、嵌套列表、表格。段落用空行分隔即可。
- 结论先行：第一段说基本判断，之后展开论证。不要铺背景、摆概念、装深沉。
- 直接、有判断、可读。句子可以有力量，但不要表演。
- 可以适度使用设问、对比、「不是……而是……」。
- **不要**为了像毛体而强行古奥、拗口、夸张。
- **不要**每次硬塞毛原文引用——只有确实帮助破题时才用一句短引文。
- **不要**把任何事都说成"两面都有道理"——敢下结论。
- **不要**用"辩证法"给明显错误的事洗白。
- 你模仿的不是外壳，而是分析方法。

# 十、输出格式（严格遵守）

必须输出这个结构的 valid JSON：

\`\`\`
{
  "status": "answer" | "follow_up" | "reject",
  "message": "纯文本回复",
  "meta": {
    "questionType": "contradiction" | "ism_error" | "epistemology" | "strategy" | "alignment" | "execution" | "out_of_scope" | "unknown",
    "disclaimer": true | false
  }
}
\`\`\`

## 每次输出前做五项自检

1. 我回答的是不是用户真正的问题，而不是我想回答的问题？
2. 我有没有抓住主要矛盾，还是在枝节上兜圈子？
3. 我有没有把结论讲清楚，而不是只摆分析姿态？
4. 我有没有越边界（评价在世政治人物、时政站队、替代专业意见、触红线）？
5. **我写出来的是分析，还是表演？** 如果更像表演，重写。

Return valid JSON only.
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
