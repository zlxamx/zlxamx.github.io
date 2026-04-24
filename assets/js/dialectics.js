const ANALYSIS_PATHS = [
  { key: "contradiction_analysis", label: "矛盾分析" },
  { key: "concrete_analysis", label: "具体问题具体分析" },
  { key: "primary_secondary", label: "主次矛盾" },
  { key: "quantity_quality", label: "量变质变" },
  { key: "practice_test", label: "实践检验" },
  { key: "internal_external", label: "内因外因" },
];

const ANALYSIS_PATH_INDEX = ANALYSIS_PATHS.reduce((acc, item) => {
  acc[item.key] = item;
  return acc;
}, {});

const ANALYSIS_PATH_SOURCE_LABEL = {
  user: "你的提问",
  assistant: "本次分析",
};

function normalizeAnalysisPaths(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const seenKeys = new Set();
  const out = [];

  raw.forEach((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;

    const key = typeof entry.key === "string" && ANALYSIS_PATH_INDEX[entry.key] ? entry.key : "";
    const quote = typeof entry.quote === "string" ? entry.quote.trim() : "";
    const source = entry.source === "user" || entry.source === "assistant" ? entry.source : "";
    const explanation = typeof entry.explanation === "string" ? entry.explanation.trim() : "";

    if (!key || !quote || !source || !explanation) return;
    if (seenKeys.has(key)) return;

    seenKeys.add(key);
    out.push({ key, quote, source, explanation });
  });

  return out.slice(0, 4);
}

function createSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `dialectics-${Date.now()}`;
}

function normalizeStoredMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message)) {
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
    createdAt: typeof message.createdAt === "string" ? message.createdAt : "",
    analysisPaths: normalizeAnalysisPaths(message.analysisPaths),
  };
}

function normalizeStoredMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map(normalizeStoredMessage).filter(Boolean);
}

function loadState(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        sessionId: createSessionId(),
        draft: "",
        archivedMessages: [],
        messages: [],
      };
    }

    const parsed = JSON.parse(raw);

    return {
      sessionId: parsed.sessionId || createSessionId(),
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      archivedMessages: normalizeStoredMessages(parsed.archivedMessages),
      messages: normalizeStoredMessages(parsed.messages),
    };
  } catch (error) {
    return {
      sessionId: createSessionId(),
      draft: "",
      archivedMessages: [],
      messages: [],
    };
  }
}

function saveState(storageKey, state) {
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        sessionId: state.sessionId,
        draft: state.draft,
        archivedMessages: state.archivedMessages,
        messages: state.messages,
      }),
    );
    return true;
  } catch (error) {
    return false;
  }
}

function getMessageLabel(message) {
  if (message.role === "user") {
    return "你";
  }

  const kind = message.kind || "answer";

  if (kind === "follow_up") {
    return "追问";
  }

  if (kind === "reject") {
    return "边界";
  }

  return "分析";
}

function formatExportTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return {
    display: `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`,
    file: `${year}-${month}-${day}-${hours}${minutes}${seconds}`,
  };
}

function formatMessageTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return formatExportTimestamp(date).display;
}

function createMessage(role, kind, content, analysisPaths = []) {
  return {
    role,
    kind,
    content,
    createdAt: new Date().toISOString(),
    analysisPaths: normalizeAnalysisPaths(analysisPaths),
  };
}

function createAnalysisPathsElement(paths) {
  const details = document.createElement("details");
  details.className = "dialectics-paths";

  const summary = document.createElement("summary");
  summary.className = "dialectics-paths-summary";
  summary.textContent = `本次用到的分析路径（${paths.length}）`;
  details.append(summary);

  const list = document.createElement("ul");
  list.className = "dialectics-paths-list";

  paths.forEach((path) => {
    const meta = ANALYSIS_PATH_INDEX[path.key];
    if (!meta) return;

    const item = document.createElement("li");
    item.className = "dialectics-paths-item";

    const label = document.createElement("span");
    label.className = "dialectics-paths-label";
    label.textContent = meta.label;

    const quoteWrap = document.createElement("span");
    quoteWrap.className = "dialectics-paths-quote";
    const quoteText = document.createElement("span");
    quoteText.className = "dialectics-paths-quote-text";
    quoteText.textContent = `「${path.quote}」`;
    const quoteSource = document.createElement("span");
    quoteSource.className = "dialectics-paths-source";
    quoteSource.textContent = `— ${ANALYSIS_PATH_SOURCE_LABEL[path.source] || ""}`;
    quoteWrap.append(quoteText, quoteSource);

    const explanation = document.createElement("span");
    explanation.className = "dialectics-paths-explanation";
    explanation.textContent = path.explanation;

    item.append(label, quoteWrap, explanation);
    list.append(item);
  });

  details.append(list);
  return details;
}

function createExportPayload(pageTitle, state) {
  const timestamp = formatExportTimestamp(new Date());
  const transcript = [...state.archivedMessages, ...state.messages];
  const lines = [
    `# ${pageTitle}聊天记录`,
    "",
    `- 导出时间：${timestamp.display}`,
    `- 会话 ID：${state.sessionId}`,
    `- 消息数：${transcript.length}`,
    `- 更早的对话条数：${state.archivedMessages.length}`,
  ];

  if (transcript.length) {
    lines.push("", "## 对话记录");

    transcript.forEach((message, index) => {
      const formattedTimestamp = formatMessageTimestamp(message.createdAt);
      const heading = formattedTimestamp
        ? `### ${index + 1}. ${getMessageLabel(message)} · ${formattedTimestamp}`
        : `### ${index + 1}. ${getMessageLabel(message)}`;

      lines.push(
        "",
        heading,
        "",
        message.content.trim() || "（空内容）",
      );

      const paths = Array.isArray(message.analysisPaths) ? message.analysisPaths : [];
      if (
        message.role === "assistant" &&
        (message.kind || "answer") === "answer" &&
        paths.length > 0
      ) {
        lines.push("", "本次用到的分析路径：");
        paths.forEach((path) => {
          const meta = ANALYSIS_PATH_INDEX[path.key];
          if (!meta) return;
          const sourceLabel = ANALYSIS_PATH_SOURCE_LABEL[path.source] || "";
          lines.push(
            `- ${meta.label}`,
            `  - 引文「${path.quote}」${sourceLabel ? `（出自${sourceLabel}）` : ""}`,
            `  - ${path.explanation}`,
          );
        });
      }
    });
  }

  if (state.draft.trim()) {
    lines.push(
      "",
      "## 未发送草稿",
      "",
      state.draft.trim(),
    );
  }

  return {
    content: `${lines.join("\n")}\n`,
    filename: `dialectics-chat-${timestamp.file}.md`,
  };
}

function downloadTextFile(filename, content) {
  const blob = new window.Blob([content], {
    type: "text/markdown;charset=utf-8",
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 0);
}

function hasExportableContent(state) {
  return state.archivedMessages.length > 0 || state.messages.length > 0 || state.draft.trim().length > 0;
}

function createRequestSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new window.AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function normalizeApiTarget(value) {
  if (typeof value !== "string") {
    return "";
  }

  const target = value.trim();
  if (!target) {
    return "";
  }

  try {
    return new window.URL(target, window.location.origin).toString();
  } catch (error) {
    return "";
  }
}

function buildApiTargets(values) {
  const seen = new Set();

  return values
    .map(normalizeApiTarget)
    .filter((target) => {
      if (!target || seen.has(target)) {
        return false;
      }

      seen.add(target);
      return true;
    });
}

function orderApiTargets(activeApiUrl, apiTargets) {
  const seen = new Set();

  return [activeApiUrl, ...apiTargets].filter((target) => {
    if (!target || seen.has(target)) {
      return false;
    }

    seen.add(target);
    return true;
  });
}

function archiveOverflowMessages(state, maxHistoryMessages) {
  if (maxHistoryMessages <= 0 || state.messages.length <= maxHistoryMessages) {
    return 0;
  }

  const overflowCount = state.messages.length - maxHistoryMessages;
  const overflowMessages = state.messages.slice(0, overflowCount);

  state.archivedMessages = state.archivedMessages.concat(overflowMessages);
  state.messages = state.messages.slice(-maxHistoryMessages);
  return overflowCount;
}

function setRuntimeStatus(button, note, kind, options = {}) {
  if (!button || !note) {
    return;
  }

  const label = button.querySelector("[data-dialectics-runtime-label]");
  const states = {
    online: {
      label: "在线",
      note: "把你想搞清楚的事写下来，它会帮你一起拆开来看。",
    },
    offline: {
      label: "暂不可用",
      note: "现在暂时没法发送，你可以先把问题写下来。",
    },
    error: {
      label: "发送失败",
      note: "刚才没发出去，你写的内容没丢。",
    },
  };
  const nextState = states[kind] || states.offline;

  button.classList.remove("is-online", "is-offline", "is-error");
  button.classList.add(`is-${kind}`);

  if (label) {
    label.textContent = nextState.label;
  }

  note.textContent = nextState.note;
}

function createMessageElement(message) {
  const article = document.createElement("article");
  const label = document.createElement("p");
  const body = document.createElement("p");

  article.className = "dialectics-message";
  label.className = "dialectics-message-label";
  body.className = "dialectics-message-body";
  body.textContent = message.content;

  if (message.role === "user") {
    article.classList.add("is-user");
    label.textContent = "你";
  } else {
    const kind = message.kind || "answer";
    article.classList.add(`is-${kind}`);

    if (kind === "follow_up") {
      label.textContent = "追问";
    } else if (kind === "reject") {
      label.textContent = "边界";
    } else {
      label.textContent = "分析";
    }
  }

  article.append(label, body);

  const paths = Array.isArray(message.analysisPaths) ? message.analysisPaths : [];
  if (
    message.role === "assistant" &&
    (message.kind || "answer") === "answer" &&
    paths.length > 0
  ) {
    article.append(createAnalysisPathsElement(paths));
  }

  return article;
}

function createArchiveNoticeElement(archiveCount, maxHistoryMessages) {
  const article = document.createElement("article");
  const label = document.createElement("p");
  const body = document.createElement("p");

  article.className = "dialectics-message is-system is-archived";
  label.className = "dialectics-message-label";
  body.className = "dialectics-message-body";

  label.textContent = "更早的对话";
  body.textContent = `更早的 ${archiveCount} 条对话已经不再参与现在的分析。继续提问时，只会看最近 ${maxHistoryMessages} 条。想保留完整内容，可以先点导出。`;

  article.append(label, body);
  return article;
}

function renderThread(
  thread,
  messages,
  emptyMessage,
  archiveCount = 0,
  maxHistoryMessages = 0,
  examplePrompts = []
) {
  thread.innerHTML = "";

  if (archiveCount > 0 && maxHistoryMessages > 0) {
    thread.append(createArchiveNoticeElement(archiveCount, maxHistoryMessages));
  }

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "dialectics-empty";
    empty.dataset.dialecticsPlaceholder = "";

    const lead = document.createElement("p");
    lead.className = "dialectics-empty-lead";
    lead.textContent = emptyMessage;
    empty.append(lead);

    if (examplePrompts.length) {
      const kicker = document.createElement("p");
      kicker.className = "dialectics-empty-kicker";
      kicker.textContent = "或从下面这几个开始";
      empty.append(kicker);

      const list = document.createElement("ul");
      list.className = "dialectics-empty-chips";
      examplePrompts.forEach((prompt) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "dialectics-prompt-chip";
        btn.setAttribute("aria-label", "填入问题");
        btn.dataset.dialecticsPrompt = prompt;
        const span = document.createElement("span");
        span.className = "dialectics-prompt-copy";
        span.textContent = prompt;
        btn.append(span);
        li.append(btn);
        list.append(li);
      });
      empty.append(list);
    }

    thread.append(empty);
    return;
  }

  messages.forEach((message) => {
    thread.append(createMessageElement(message));
  });

  thread.scrollTop = thread.scrollHeight;
}

function syncInfoPanel(panel, triggers, contents, activeKey) {
  if (!panel) {
    return;
  }

  panel.hidden = !activeKey;

  triggers.forEach((button) => {
    const isActive = button.dataset.dialecticsInfoTrigger === activeKey;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-expanded", String(isActive));
    button.setAttribute("aria-pressed", String(isActive));
  });

  contents.forEach((section) => {
    section.hidden = section.dataset.dialecticsInfoContent !== activeKey;
  });
}

function syncComposer(
  input,
  count,
  status,
  exportButton,
  submitButton,
  state,
  inputLimit,
  maxHistoryMessages,
  hasApiTarget,
  pending,
  statusMessage = "",
) {
  // Skip button state updates if in share mode
  if (shareMode) {
    return;
  }

  const length = input.value.trim().length;
  count.textContent = String(length);
  state.storageFailed = !saveState(state.storageKey, state);
  exportButton.disabled = !hasExportableContent(state);
  const storageWarning = state.storageFailed ? "刚才没存成功，刷新页面可能会丢。" : "";

  if (pending) {
    submitButton.disabled = true;
    submitButton.textContent = "发送中...";
    if (statusMessage) {
      status.textContent = statusMessage;
    } else if (storageWarning) {
      status.textContent = storageWarning;
    }
    return;
  }

  if (!hasApiTarget) {
    submitButton.disabled = true;
    submitButton.textContent = "暂不可用";
    status.textContent = statusMessage || storageWarning || "这个网站不会保存你的对话数据。";
    return;
  }

  submitButton.disabled = length === 0 || length > inputLimit;
  submitButton.textContent = "发送";

  if (statusMessage) {
    status.textContent = statusMessage;
  } else if (storageWarning) {
    status.textContent = storageWarning;
  } else if (!length) {
    status.textContent = "这个网站不会保存你的对话数据。";
  } else if (state.archivedMessages.length && maxHistoryMessages > 0) {
    status.textContent = `这次分析只会参考最近 ${maxHistoryMessages} 条对话，更早的不会带进来。`;
  } else {
    status.textContent = "可以发送了。如果信息不够，会先追问你一句。";
  }
}

async function sendPrompt(apiUrl, payload) {
  const response = await window.fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: createRequestSignal(45000),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

async function sendPromptWithFailover(apiTargets, activeApiUrl, payload) {
  let lastError = null;
  const requestTargets = orderApiTargets(activeApiUrl, apiTargets);
  const primaryApiTarget = apiTargets[0] || "";

  for (const apiTarget of requestTargets) {
    try {
      const result = await sendPrompt(apiTarget, payload);

      return {
        result,
        apiUrl: apiTarget,
        usingFallback: primaryApiTarget ? apiTarget !== primaryApiTarget : false,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("No API target configured.");
}

// ── Share mode state ────────────────────────────────────────────────
let shareMode = false;

function createShareCardElement(selectedMessages, pageTitle) {
  // ── Card wrapper ───────────────────────────────────────────────────────
  const card = document.createElement("div");
  card.style.cssText = `
    background: #f5f5f5;
    font-family: "Noto Sans SC", "PingFang SC", -apple-system, "Helvetica Neue", Arial, sans-serif;
    padding: 32px;
    width: 1080px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    box-sizing: border-box;
  `;

  // ── Header: avatar + brand | tagline ───────────────────────────────────
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 4px;
  `;

  // Left: avatar + name + subtitle
  const headerLeft = document.createElement("div");
  headerLeft.style.cssText = "display: flex; align-items: center; gap: 18px;";

  const avatar = document.createElement("img");
  avatar.style.cssText = `
    width: 60px; height: 60px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  `;
  avatar.src = "/img/avatar.png";
  avatar.alt = "头像";
  avatar.crossOrigin = "anonymous";
  avatar.onerror = function() { this.style.background = "#ddd"; };

  const brandInfo = document.createElement("div");
  brandInfo.style.cssText = "display: flex; flex-direction: column; gap: 6px;";

  const brandName = document.createElement("span");
  brandName.style.cssText = "font-size: 26px; font-weight: 700; color: #222;";
  brandName.textContent = "希路路克";

  const brandDesc = document.createElement("span");
  brandDesc.style.cssText = "font-size: 15px; color: #999;";
  brandDesc.textContent = "记录我关心的事物，也理解它们。";

  brandInfo.append(brandName, brandDesc);
  headerLeft.append(avatar, brandInfo);

  // Right: tagline text
  const tagline = document.createElement("span");
  tagline.style.cssText = "font-size: 15px; color: #999; letter-spacing: 0.06em; flex-shrink: 0;";
  tagline.textContent = "深度思考 · 理性分析 · 建设性建议";

  header.append(headerLeft, tagline);

  // ── Message sections ──────────────────────────────────────────────────
  const fragment = document.createDocumentFragment();

  selectedMessages.forEach((msg) => {
    const isUser = msg.role === "user";

    const section = document.createElement("div");
    section.style.cssText = `
      background: ${isUser ? "#fef8ec" : "#ffffff"};
      border-radius: 18px;
      padding: 28px 32px;
    `;

    // Badge row: circle badge + label
    const badgeRow = document.createElement("div");
    badgeRow.style.cssText = "display: flex; align-items: center; gap: 14px; margin-bottom: 18px;";

    const badge = document.createElement("div");
    badge.style.cssText = `
      width: 38px; height: 38px;
      border-radius: 50%;
      background: ${isUser ? "#c89045" : "#5b90d9"};
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700; color: #fff;
      flex-shrink: 0; line-height: 1;
    `;
    badge.textContent = isUser ? "问" : "答";

    const labelText = document.createElement("span");
    labelText.style.cssText = `
      font-size: 20px;
      font-weight: 600;
      color: ${isUser ? "#c89045" : "#5b90d9"};
    `;
    labelText.textContent = isUser ? "提问" : "回答";

    badgeRow.append(badge, labelText);

    const body = document.createElement("p");
    body.style.cssText = `
      margin: 0;
      font-size: 24px;
      line-height: 1.8;
      white-space: pre-wrap;
      color: #222;
    `;
    body.textContent = msg.content;

    section.append(badgeRow, body);
    fragment.append(section);
  });

  // ── Footer: avatar + brand + desc | cta + QR code ──────────────────────
  const footer = document.createElement("div");
  footer.style.cssText = `
    background: #eeeeee;
    border-radius: 18px;
    padding: 20px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `;

  const footerLeft = document.createElement("div");
  footerLeft.style.cssText = "display: flex; align-items: center; gap: 10px;";

  const footerAvatar = document.createElement("img");
  footerAvatar.style.cssText = `
    width: 36px; height: 36px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  `;
  footerAvatar.src = "/img/avatar.png";
  footerAvatar.alt = "头像";
  footerAvatar.crossOrigin = "anonymous";
  footerAvatar.onerror = function() { this.style.background = "#ddd"; };

  const footerBrandInfo = document.createElement("div");
  footerBrandInfo.style.cssText = "display: flex; flex-direction: column; gap: 4px;";

  const footerBrandName = document.createElement("span");
  footerBrandName.style.cssText = "font-size: 19px; font-weight: 600; color: #333;";
  footerBrandName.textContent = "希路路克";

  const footerBrandSub = document.createElement("span");
  footerBrandSub.style.cssText = "font-size: 13px; color: #999;";
  footerBrandSub.textContent = "记录我关心的事物，也理解它们。";

  footerBrandInfo.append(footerBrandName, footerBrandSub);
  footerLeft.append(footerAvatar, footerBrandInfo);

  const footerRight = document.createElement("div");
  footerRight.style.cssText = "display: flex; align-items: center; gap: 14px;";

  const ctaText = document.createElement("span");
  ctaText.style.cssText = "font-size: 16px; color: #999;";
  ctaText.textContent = "长按识别二维码 → 向我提问";

  const qrBlock = document.createElement("div");
  qrBlock.style.cssText = `
    width: 56px; height: 56px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: #fff;
  `;

  const qrImg = document.createElement("img");
  qrImg.style.cssText = "width: 100%; height: 100%; object-fit: contain; display: block;";
  qrImg.src = "/images/wechat-qr-code.png";
  qrImg.alt = "二维码";
  qrImg.crossOrigin = "anonymous";
  qrImg.onerror = () => { qrBlock.textContent = "二维码"; };
  qrImg.onload  = () => { qrBlock.innerHTML = ""; qrBlock.append(qrImg); };
  qrBlock.append(qrImg);

  footerRight.append(ctaText, qrBlock);
  footer.append(footerLeft, footerRight);

  // ── Assemble card ─────────────────────────────────────────────────────
  card.append(header, fragment, footer);
  return card;
}

async function generateShareImage(selectedMessages, pageTitle) {
  if (typeof window.html2canvas !== "function") {
    throw new Error("html2canvas not loaded");
  }

  const card = createShareCardElement(selectedMessages, pageTitle);

  // Create a visible container for rendering (html2canvas works better with visible elements)
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    left: 0;
    top: 0;
    width: 1080px;
    z-index: 10000;
    opacity: 0;
    pointer-events: none;
  `;
  container.append(card);
  document.body.append(container);

  try {
    // Wait for images and rendering
    await new Promise((r) => setTimeout(r, 200));

    const cardHeight = card.scrollHeight;
    const canvas = await window.html2canvas(card, {
      scale: 2,
      backgroundColor: "#f5f5f5",
      useCORS: true,
      logging: false,
      width: 1080,
      height: cardHeight,
      windowWidth: 1080,
    });

    const timestamp = formatExportTimestamp(new Date()).file;
    const link = document.createElement("a");
    link.download = `dialectics-share-${timestamp}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    container.remove();
  }
}

function initDialecticsPage() {
  const root = document.querySelector("[data-dialectics-root]");
  if (!root) {
    return;
  }

  const apiTargets = buildApiTargets([
    root.dataset.apiPath || "",
    root.dataset.apiUrl || "",
  ]);
  const hasApiTarget = apiTargets.length > 0;
  let activeApiUrl = apiTargets[0] || "";
  const pageTitle = root.dataset.pageTitle || "唯物辩证法答问";
  const storageKey = root.dataset.storageKey || "materialist-dialectics-chat";
  const inputLimit = Number(root.dataset.inputLimit || 1600);
  const maxHistoryMessages = Number(root.dataset.maxHistoryMessages || 8);
  const emptyMessage = root.dataset.emptyMessage || "请提出一个需要分析的问题。";

  const thread = root.querySelector("[data-dialectics-thread]");
  const form = root.querySelector("[data-dialectics-form]");
  const input = root.querySelector("[data-dialectics-input]");
  const count = root.querySelector("[data-dialectics-count]");
  const status = root.querySelector("[data-dialectics-status]");
  const exportButton = root.querySelector("[data-dialectics-export]");
  const resetButton = root.querySelector("[data-dialectics-reset]");
  const submitButton = root.querySelector("[data-dialectics-submit]");
  const runtimeStatus = root.querySelector("[data-dialectics-runtime-status]");
  const runtimeNote = root.querySelector("[data-dialectics-runtime-note]");
  const promptButtons = Array.from(root.querySelectorAll("[data-dialectics-prompt]"));
  const examplePrompts = Array.from(
    root.querySelectorAll("[data-dialectics-placeholder] [data-dialectics-prompt]")
  ).map((el) => el.dataset.dialecticsPrompt);
  const infoPanel = root.querySelector("[data-dialectics-info-panel]");
  const infoTriggers = Array.from(root.querySelectorAll("[data-dialectics-info-trigger]"));
  const infoContents = Array.from(root.querySelectorAll("[data-dialectics-info-content]"));

  // Share button
  const shareButton = root.querySelector("[data-dialectics-share]");

  const state = loadState(storageKey);
  state.storageKey = storageKey;
  state.storageFailed = false;

  let pending = false;
  let activeInfoKey = "";
  archiveOverflowMessages(state, maxHistoryMessages);

  setRuntimeStatus(runtimeStatus, runtimeNote, hasApiTarget ? "online" : "offline", {
    hasFallback: apiTargets.length > 1,
  });
  syncInfoPanel(infoPanel, infoTriggers, infoContents, activeInfoKey);
  input.value = state.draft;
  renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages, examplePrompts);
  syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending);

  input.addEventListener("input", () => {
    state.draft = input.value;
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending);
  });

  // 事件委托：挂在 thread 父容器上，动态重建的 chips 也能命中
  thread.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-dialectics-prompt]");
    if (!chip) return;
    input.value = chip.dataset.dialecticsPrompt || "";
    state.draft = input.value;
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending);
    input.focus();
  });

  infoTriggers.forEach((button) => {
    button.addEventListener("click", () => {
      const nextKey = button.dataset.dialecticsInfoTrigger || "";
      activeInfoKey = activeInfoKey === nextKey ? "" : nextKey;
      syncInfoPanel(infoPanel, infoTriggers, infoContents, activeInfoKey);
    });
  });

  exportButton.addEventListener("click", () => {
    state.draft = input.value;
    state.storageFailed = !saveState(state.storageKey, state);

    if (!hasExportableContent(state)) {
      status.textContent = "现在还没有可以导出的对话。";
      return;
    }

    try {
      const payload = createExportPayload(pageTitle, state);
      downloadTextFile(payload.filename, payload.content);
      status.textContent = "对话已经保存到下载文件里。";
    } catch (error) {
      status.textContent = "导出失败，请稍后再试。";
    }
  });

  resetButton.addEventListener("click", () => {
    const shouldReset = window.confirm("清空后，现在的对话和还没发送的内容都会删除，无法恢复。");
    if (!shouldReset) {
      return;
    }

    state.sessionId = createSessionId();
    state.draft = "";
    state.archivedMessages = [];
    state.messages = [];
    input.value = "";
    renderThread(thread, state.messages, emptyMessage, 0, 0, examplePrompts);
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = input.value.trim();
    if (!prompt || !hasApiTarget || pending) {
      return;
    }

    pending = true;
    archiveOverflowMessages(state, maxHistoryMessages);
    const previousMessages = state.messages.slice();

    const userMessage = createMessage("user", "question", prompt);

    state.messages.push(userMessage);
    state.draft = "";
    input.value = "";
    renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages, examplePrompts);
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending);
    status.textContent = "正在发送...";

    let settledStatus = "";

    try {
      const { result, apiUrl } = await sendPromptWithFailover(apiTargets, activeApiUrl, {
        page: "materialist-dialectics",
        sessionId: state.sessionId,
        messages: previousMessages,
        input: prompt,
      });
      activeApiUrl = apiUrl;

      state.messages.push(
        createMessage(
          "assistant",
          result.status || "answer",
          result.message || "这次没拿到回复内容。",
          result && result.meta ? result.meta.analysisPaths : [],
        ),
      );
      archiveOverflowMessages(state, maxHistoryMessages);

      setRuntimeStatus(runtimeStatus, runtimeNote, "online");
      renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages, examplePrompts);
      settledStatus = "已收到回复。";
    } catch (error) {
      state.messages = previousMessages;
      state.draft = prompt;
      input.value = prompt;
      setRuntimeStatus(runtimeStatus, runtimeNote, hasApiTarget ? "error" : "offline");
      renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages, examplePrompts);
      settledStatus = "没发出去，你写的内容没丢。";
    } finally {
      pending = false;
      syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, hasApiTarget, pending, settledStatus);
    }
  });

  // ── Share button event listener ──────────────────────────────────────
  shareButton.addEventListener("click", async () => {
    if (!state.messages.length) {
      status.textContent = "现在还没有可以分享的对话。";
      return;
    }

    shareButton.disabled = true;
    shareButton.textContent = "生成中...";
    status.textContent = "正在生成图片...";

    try {
      const allMessages = [...state.archivedMessages, ...state.messages];
      await generateShareImage(allMessages, pageTitle);
      status.textContent = "图片已保存到下载文件里。";
    } catch (error) {
      status.textContent = "生成图片失败，请稍后再试。";
      console.error("Share image generation failed:", error);
    } finally {
      shareButton.disabled = false;
      shareButton.textContent = "图片分享";
    }
  });
}

document.addEventListener("DOMContentLoaded", initDialecticsPage);
