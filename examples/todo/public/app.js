const CFG = window.FLEX_CONFIG ?? { apiBase: "", httpOnly: false, pollIntervalMs: 3000 };
const API = (CFG.apiBase || "").replace(/\/$/, "");

const STORAGE_TOKEN = "flex_token";
const STORAGE_PROJECT = "flex_project_id";

const $ = (sel) => document.querySelector(sel);

const authScreen = $("#auth-screen");
const appScreen = $("#app-screen");
const statusEl = $("#status");
const statusText = statusEl.querySelector(".status-text");
const btnLogout = $("#btn-logout");
const projectSelect = $("#project-select");
const userLine = $("#user-line");
const todoList = $("#todo-list");
const todoCount = $("#todo-count");

let ws;
let pollTimer;
let state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  projectId: localStorage.getItem(STORAGE_PROJECT),
  user: null,
  projects: [],
};

function apiUrl(path) {
  return API ? `${API}${path}` : path;
}

function headers() {
  const h = { "Content-Type": "application/json" };
  if (state.token) h.Authorization = `Bearer ${state.token}`;
  if (state.projectId) h["X-Project-Id"] = state.projectId;
  return h;
}

function setStatus(stateClass, text) {
  statusEl.className = `status ${stateClass}`;
  statusText.textContent = text;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

async function parseApiResponse(res) {
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Сервер вернул неверный JSON");
    }
  }
  if (text.startsWith("{")) {
    try {
      return JSON.parse(text);
    } catch {
      /* fall through */
    }
  }
  const preview = text.replace(/\s+/g, " ").slice(0, 120);
  throw new Error(
    res.ok
      ? `Ответ не JSON: ${preview}`
      : `Ошибка сервера (${res.status}): ${preview || res.statusText}`
  );
}

async function httpRun(path, args = {}) {
  const res = await fetch(apiUrl("/api/run"), {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ path, args }),
  });
  const data = await parseApiResponse(res);
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data.value;
}

function showAuth() {
  authScreen.hidden = false;
  appScreen.hidden = true;
  btnLogout.hidden = true;
}

function showApp() {
  authScreen.hidden = true;
  appScreen.hidden = false;
  btnLogout.hidden = false;
}

async function loadMe() {
  const me = await httpRun("auth:me", {});
  state.user = me.user;
  state.projects = me.projects;
  userLine.textContent = `${me.user.name} · ${me.user.email}`;

  projectSelect.innerHTML = me.projects
    .map(
      (p) =>
        `<option value="${p._id}" ${p._id === state.projectId ? "selected" : ""}>${escapeHtml(p.name)}</option>`
    )
    .join("");

  if (!state.projectId && me.projects[0]) {
    state.projectId = me.projects[0]._id;
    localStorage.setItem(STORAGE_PROJECT, state.projectId);
    projectSelect.value = state.projectId;
  }

  showApp();
}

async function refreshTodos() {
  if (!state.token || !state.projectId) return;
  try {
    const todos = await httpRun("todos:list", {});
    renderTodos(todos);
  } catch (err) {
    setStatus("error", err.message);
  }
}

function renderTodos(todos) {
  if (!Array.isArray(todos) || todos.length === 0) {
    todoList.innerHTML = '<li class="todo-empty">Нет задач в проекте</li>';
    todoCount.textContent = "0";
    return;
  }
  todoCount.textContent = String(todos.length);
  todoList.innerHTML = todos
    .map(
      (t) => `
    <li class="todo-item ${t.completed ? "done" : ""}" data-id="${escapeHtml(t._id)}">
      <div class="todo-check" data-action="toggle"></div>
      <span class="todo-text">${escapeHtml(t.text)}</span>
      <button type="button" class="btn btn-ghost" data-action="delete">×</button>
    </li>`
    )
    .join("");
}

function stopSync() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  ws?.close();
  ws = undefined;
}

function startPolling() {
  stopSync();
  setStatus("connected", "HTTP");
  void refreshTodos();
  pollTimer = setInterval(refreshTodos, CFG.pollIntervalMs ?? 3000);
}

function connectWs() {
  stopSync();
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const host = API ? new URL(API).host : location.host;
  ws = new WebSocket(`${proto}//${host}`);

  ws.onopen = () => {
    setStatus("connected", "Live");
    ws.send(
      JSON.stringify({
        type: "subscribe",
        subscriptionId: crypto.randomUUID(),
        path: "todos:list",
        args: {},
        token: state.token,
        projectId: state.projectId,
      })
    );
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "subscription_update") renderTodos(msg.value);
    if (msg.type === "subscription_error") setStatus("error", msg.error);
  };

  ws.onclose = () => {
    if (state.token) startPolling();
  };

  ws.onerror = () => startPolling();
}

function startSync() {
  if (!state.token || !state.projectId) return;
  if (CFG.httpOnly) startPolling();
  else connectWs();
}

async function mutate(path, args) {
  if (CFG.httpOnly || !ws || ws.readyState !== WebSocket.OPEN) {
    await httpRun(path, args);
    await refreshTodos();
    return;
  }
  return new Promise((resolve, reject) => {
    const handler = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type === "mutation_result") {
        ws.removeEventListener("message", handler);
        resolve(msg.value);
      }
      if (msg.type === "error") {
        ws.removeEventListener("message", handler);
        reject(new Error(msg.error));
      }
    };
    ws.addEventListener("message", handler);
    ws.send(
      JSON.stringify({
        type: "mutation",
        path,
        args,
        token: state.token,
        projectId: state.projectId,
      })
    );
  });
}

// Auth tabs
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const name = tab.dataset.tab;
    $("#form-login").hidden = name !== "login";
    $("#form-register").hidden = name !== "register";
  });
});

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await httpRun("auth:login", {
      email: $("#login-email").value,
      password: $("#login-password").value,
    });
    state.token = res.token;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    if (res.projectIds?.[0]) {
      state.projectId = res.projectIds[0];
      localStorage.setItem(STORAGE_PROJECT, state.projectId);
    }
    await loadMe();
    startSync();
  } catch (err) {
    alert(err.message);
  }
});

$("#form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await httpRun("auth:register", {
      name: $("#reg-name").value,
      email: $("#reg-email").value,
      password: $("#reg-password").value,
    });
    state.token = res.token;
    state.projectId = res.project._id;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    localStorage.setItem(STORAGE_PROJECT, state.projectId);
    await loadMe();
    startSync();
  } catch (err) {
    alert(err.message);
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await httpRun("auth:logout", {});
  } catch {
    /* ignore */
  }
  state.token = null;
  state.projectId = null;
  state.user = null;
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_PROJECT);
  stopSync();
  showAuth();
});

projectSelect.addEventListener("change", () => {
  state.projectId = projectSelect.value;
  localStorage.setItem(STORAGE_PROJECT, state.projectId);
  startSync();
});

$("#form-new-project").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#new-project-name").value.trim();
  if (!name) return;
  try {
    const p = await httpRun("projects:create", { name });
    state.projectId = p._id;
    localStorage.setItem(STORAGE_PROJECT, state.projectId);
    $("#new-project-name").value = "";
    await loadMe();
    startSync();
  } catch (err) {
    alert(err.message);
  }
});

$("#add-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("#todo-input").value.trim();
  if (!text) return;
  $("#todo-input").value = "";
  try {
    await mutate("todos:add", { text });
  } catch (err) {
    alert(err.message);
  }
});

todoList.addEventListener("click", async (e) => {
  const item = e.target.closest(".todo-item");
  if (!item) return;
  const id = item.dataset.id;
  const action = e.target.dataset.action;
  try {
    if (action === "toggle") await mutate("todos:toggle", { id });
    if (action === "delete") await mutate("todos:remove", { id });
  } catch (err) {
    alert(err.message);
  }
});

// Init
fetch(apiUrl("/api/health"))
  .then(async (r) => {
    if (!r.ok) throw new Error("offline");
    if (state.token) {
      try {
        await loadMe();
        startSync();
      } catch {
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_PROJECT);
        state.token = null;
        state.projectId = null;
        showAuth();
        setStatus("", "Войдите снова");
      }
    } else {
      showAuth();
      setStatus("", "Готов");
    }
  })
  .catch(() => {
    showAuth();
    setStatus("error", "Сервер недоступен");
  });
