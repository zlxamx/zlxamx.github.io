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
    return "页面 · 追问";
  }

  if (kind === "reject") {
    return "页面 · 边界";
  }

  return "页面 · 分析";
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

function createMessage(role, kind, content) {
  return {
    role,
    kind,
    content,
    createdAt: new Date().toISOString(),
  };
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
    `- 已归档消息数：${state.archivedMessages.length}`,
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

function setRuntimeStatus(button, note, kind) {
  if (!button || !note) {
    return;
  }

  const label = button.querySelector("[data-dialectics-runtime-label]");
  const states = {
    online: {
      label: "后端在线",
      note: "现在可以直接提交问题并拿到分析回复。",
    },
    offline: {
      label: "后端离线",
      note: "现在还不能发出请求，但你仍然可以先整理草稿。",
    },
    error: {
      label: "连接异常",
      note: "刚才这次请求失败，问题草稿已经保留在本地。",
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
      label.textContent = "页面 · 追问";
    } else if (kind === "reject") {
      label.textContent = "页面 · 边界";
    } else {
      label.textContent = "页面 · 分析";
    }
  }

  article.append(label, body);
  return article;
}

function createArchiveNoticeElement(archiveCount, maxHistoryMessages) {
  const article = document.createElement("article");
  const label = document.createElement("p");
  const body = document.createElement("p");

  article.className = "dialectics-message is-system is-archived";
  label.className = "dialectics-message-label";
  body.className = "dialectics-message-body";

  label.textContent = "系统 · 归档";
  body.textContent = `更早的 ${archiveCount} 条对话已归档，不再参与当前分析。继续提问时，系统只参考最近 ${maxHistoryMessages} 条历史消息；如需保留完整内容，请先导出记录。`;

  article.append(label, body);
  return article;
}

function renderThread(thread, messages, emptyMessage, archiveCount = 0, maxHistoryMessages = 0) {
  thread.innerHTML = "";

  if (archiveCount > 0 && maxHistoryMessages > 0) {
    thread.append(createArchiveNoticeElement(archiveCount, maxHistoryMessages));
  }

  if (!messages.length) {
    const placeholder = document.createElement("article");
    const label = document.createElement("p");
    const body = document.createElement("p");

    placeholder.className = "dialectics-message is-system";
    label.className = "dialectics-message-label";
    body.className = "dialectics-message-body";

    label.textContent = "系统";
    body.textContent = emptyMessage;

    placeholder.append(label, body);
    thread.append(placeholder);
    return;
  }

  messages.forEach((message) => {
    thread.append(createMessageElement(message));
  });

  thread.scrollTop = thread.scrollHeight;
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
  apiUrl,
  pending,
  statusMessage = "",
) {
  const length = input.value.trim().length;
  count.textContent = String(length);
  state.storageFailed = !saveState(state.storageKey, state);
  exportButton.disabled = !hasExportableContent(state);
  const storageWarning = state.storageFailed ? "本地保存失败，刷新后草稿和聊天记录可能丢失。" : "";

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

  if (!apiUrl) {
    submitButton.disabled = true;
    submitButton.textContent = "接口未就绪";
    status.textContent = statusMessage || storageWarning || "草稿只保存在当前设备，接口暂未接通。";
    return;
  }

  submitButton.disabled = length === 0 || length > inputLimit;
  submitButton.textContent = "发送";

  if (statusMessage) {
    status.textContent = statusMessage;
  } else if (storageWarning) {
    status.textContent = storageWarning;
  } else if (!length) {
    status.textContent = "草稿只保存在当前设备，发送前不会上传。";
  } else if (state.archivedMessages.length && maxHistoryMessages > 0) {
    status.textContent = `当前分析只参考最近 ${maxHistoryMessages} 条历史消息，更早对话已归档。`;
  } else {
    status.textContent = "可以发送了。如果关键信息不足，页面会先追问一轮。";
  }
}

async function sendPrompt(apiUrl, payload) {
  const response = await window.fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
}

function initDialecticsPage() {
  const root = document.querySelector("[data-dialectics-root]");
  if (!root) {
    return;
  }

  const apiUrl = root.dataset.apiUrl || "";
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

  const state = loadState(storageKey);
  state.storageKey = storageKey;
  state.storageFailed = false;

  let pending = false;
  archiveOverflowMessages(state, maxHistoryMessages);

  setRuntimeStatus(runtimeStatus, runtimeNote, apiUrl ? "online" : "offline");
  input.value = state.draft;
  renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages);
  syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending);

  input.addEventListener("input", () => {
    state.draft = input.value;
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending);
  });

  promptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.dialecticsPrompt || "";
      state.draft = input.value;
      syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending);
      input.focus();
    });
  });

  exportButton.addEventListener("click", () => {
    state.draft = input.value;
    state.storageFailed = !saveState(state.storageKey, state);

    if (!hasExportableContent(state)) {
      status.textContent = "当前没有可导出的聊天记录。";
      return;
    }

    try {
      const payload = createExportPayload(pageTitle, state);
      downloadTextFile(payload.filename, payload.content);
      status.textContent = "聊天记录已导出为 Markdown 文件。";
    } catch (error) {
      status.textContent = "导出失败，请稍后再试。";
    }
  });

  resetButton.addEventListener("click", () => {
    const shouldReset = window.confirm("清空后，当前会话、已归档记录和未发送草稿都会被删除，且无法恢复。");
    if (!shouldReset) {
      return;
    }

    state.sessionId = createSessionId();
    state.draft = "";
    state.archivedMessages = [];
    state.messages = [];
    input.value = "";
    renderThread(thread, state.messages, emptyMessage);
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = input.value.trim();
    if (!prompt || !apiUrl || pending) {
      return;
    }

    pending = true;
    archiveOverflowMessages(state, maxHistoryMessages);
    const previousMessages = state.messages.slice();

    const userMessage = createMessage("user", "question", prompt);

    state.messages.push(userMessage);
    state.draft = "";
    input.value = "";
    renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages);
    syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending);
    status.textContent = "正在把问题发送到后端...";

    let settledStatus = "";

    try {
      const result = await sendPrompt(apiUrl, {
        page: "materialist-dialectics",
        sessionId: state.sessionId,
        messages: previousMessages,
        input: prompt,
      });

      state.messages.push(
        createMessage(
          "assistant",
          result.status || "answer",
          result.message || "后端返回了空内容。",
        ),
      );
      archiveOverflowMessages(state, maxHistoryMessages);

      setRuntimeStatus(runtimeStatus, runtimeNote, "online");
      renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages);
      settledStatus = "已收到回复。草稿和本地对话记录仍保存在当前设备。";
    } catch (error) {
      state.messages = previousMessages;
      state.draft = prompt;
      input.value = prompt;
      setRuntimeStatus(runtimeStatus, runtimeNote, apiUrl ? "error" : "offline");
      renderThread(thread, state.messages, emptyMessage, state.archivedMessages.length, maxHistoryMessages);
      settledStatus = "当前无法连接后端。问题草稿已保留在本地。";
    } finally {
      pending = false;
      syncComposer(input, count, status, exportButton, submitButton, state, inputLimit, maxHistoryMessages, apiUrl, pending, settledStatus);
    }
  });
}

document.addEventListener("DOMContentLoaded", initDialecticsPage);
