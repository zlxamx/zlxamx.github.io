function createSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `dialectics-${Date.now()}`;
}

function loadState(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      return {
        sessionId: createSessionId(),
        draft: "",
        messages: [],
      };
    }

    const parsed = JSON.parse(raw);

    return {
      sessionId: parsed.sessionId || createSessionId(),
      draft: typeof parsed.draft === "string" ? parsed.draft : "",
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (error) {
    return {
      sessionId: createSessionId(),
      draft: "",
      messages: [],
    };
  }
}

function saveState(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    return;
  }
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
    label.textContent = "You";
  } else {
    const kind = message.kind || "answer";
    article.classList.add(`is-${kind}`);

    if (kind === "follow_up") {
      label.textContent = "Page · Clarifying";
    } else if (kind === "reject") {
      label.textContent = "Page · Boundary";
    } else {
      label.textContent = "Page · Analysis";
    }
  }

  article.append(label, body);
  return article;
}

function renderThread(thread, messages, emptyMessage) {
  thread.innerHTML = "";

  if (!messages.length) {
    const placeholder = document.createElement("article");
    const label = document.createElement("p");
    const body = document.createElement("p");

    placeholder.className = "dialectics-message is-system";
    label.className = "dialectics-message-label";
    body.className = "dialectics-message-body";

    label.textContent = "System";
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
  submitButton,
  state,
  inputLimit,
  apiUrl,
  pending,
  statusMessage = "",
) {
  const length = input.value.trim().length;
  count.textContent = String(length);
  saveState(state.storageKey, state);

  if (pending) {
    submitButton.disabled = true;
    submitButton.textContent = "Sending...";
    if (statusMessage) {
      status.textContent = statusMessage;
    }
    return;
  }

  if (!apiUrl) {
    submitButton.disabled = true;
    submitButton.textContent = "API Pending";
    status.textContent = statusMessage || "Drafts stay on this device. The API is not connected yet.";
    return;
  }

  submitButton.disabled = length === 0 || length > inputLimit;
  submitButton.textContent = "Send";

  if (statusMessage) {
    status.textContent = statusMessage;
  } else if (!length) {
    status.textContent = "Drafts stay on this device until you send them.";
  } else {
    status.textContent = "Ready to send. If the page lacks key facts, it will ask one follow-up round first.";
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
  const storageKey = root.dataset.storageKey || "materialist-dialectics-chat";
  const inputLimit = Number(root.dataset.inputLimit || 1600);
  const emptyMessage = root.dataset.emptyMessage || "Ask a question that needs analysis.";

  const thread = root.querySelector("[data-dialectics-thread]");
  const form = root.querySelector("[data-dialectics-form]");
  const input = root.querySelector("[data-dialectics-input]");
  const count = root.querySelector("[data-dialectics-count]");
  const status = root.querySelector("[data-dialectics-status]");
  const resetButton = root.querySelector("[data-dialectics-reset]");
  const submitButton = root.querySelector("[data-dialectics-submit]");
  const promptButtons = Array.from(root.querySelectorAll("[data-dialectics-prompt]"));

  const state = loadState(storageKey);
  state.storageKey = storageKey;

  let pending = false;

  input.value = state.draft;
  renderThread(thread, state.messages, emptyMessage);
  syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending);

  input.addEventListener("input", () => {
    state.draft = input.value;
    syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending);
  });

  promptButtons.forEach((button) => {
    button.addEventListener("click", () => {
      input.value = button.dataset.dialecticsPrompt || "";
      state.draft = input.value;
      syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending);
      input.focus();
    });
  });

  resetButton.addEventListener("click", () => {
    state.sessionId = createSessionId();
    state.draft = "";
    state.messages = [];
    input.value = "";
    renderThread(thread, state.messages, emptyMessage);
    syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const prompt = input.value.trim();
    if (!prompt || !apiUrl || pending) {
      return;
    }

    pending = true;
    const previousMessages = state.messages.slice();

    const userMessage = {
      role: "user",
      kind: "question",
      content: prompt,
    };

    state.messages.push(userMessage);
    state.draft = "";
    input.value = "";
    renderThread(thread, state.messages, emptyMessage);
    syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending);
    status.textContent = "Sending the question to the backend runtime...";

    let settledStatus = "";

    try {
      const result = await sendPrompt(apiUrl, {
        page: "materialist-dialectics",
        sessionId: state.sessionId,
        messages: previousMessages,
        input: prompt,
      });

      state.messages.push({
        role: "assistant",
        kind: result.status || "answer",
        content: result.message || "The backend returned an empty response.",
      });

      renderThread(thread, state.messages, emptyMessage);
      settledStatus = "Response received. Drafts and thread state are stored locally.";
    } catch (error) {
      state.messages = previousMessages;
      state.draft = prompt;
      input.value = prompt;
      renderThread(thread, state.messages, emptyMessage);
      settledStatus = "The page could not reach its backend runtime. Keep the draft local and wire the API next.";
    } finally {
      pending = false;
      syncComposer(input, count, status, submitButton, state, inputLimit, apiUrl, pending, settledStatus);
    }
  });
}

document.addEventListener("DOMContentLoaded", initDialecticsPage);
