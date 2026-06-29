const CFG = window.FLEX_CONFIG ?? { apiBase: "", httpOnly: false };
const API = (CFG.apiBase || "").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 12000;

const STORAGE_TOKEN = "flex_token";
const STORAGE_PROJECT = "flex_project_id";

const FIELD_TYPES = ["string", "number", "boolean", "id"];

const $ = (sel) => document.querySelector(sel);

const authScreen = $("#auth-screen");
const appScreen = $("#app-screen");
const statusEl = $("#status");
const statusText = statusEl.querySelector(".status-text");
const btnLogout = $("#btn-logout");
const userLine = $("#user-line");
const projectList = $("#project-list");
const projectCount = $("#project-count");
const projectsEmpty = $("#projects-empty");
const schemaSection = $("#schema-section");
const activeProjectTitle = $("#active-project-title");
const tableList = $("#table-list");
const fnList = $("#fn-list");
const tableCount = $("#table-count");
const fnCount = $("#fn-count");
const tableFields = $("#table-fields");
const fnArgs = $("#fn-args");

let state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  activeProjectId: localStorage.getItem(STORAGE_PROJECT),
  user: null,
  projects: [],
  tables: [],
  functions: [],
};

function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  );
}

function apiUrl(path) {
  return API ? `${API}${path}` : path;
}

function headers() {
  const h = { "Content-Type": "application/json" };
  if (state.token) h.Authorization = `Bearer ${state.token}`;
  if (state.activeProjectId) h["X-Project-Id"] = state.activeProjectId;
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
  const res = await fetchWithTimeout(apiUrl("/api/run"), {
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
  setStatus("connected", "В сети");
}

function fieldRowHtml(prefix) {
  const opts = FIELD_TYPES.map(
    (t) => `<option value="${t}">${t}</option>`
  ).join("");
  return `
    <div class="field-row">
      <input type="text" class="${prefix}-field-name" placeholder="Имя" required />
      <select class="${prefix}-field-type">${opts}</select>
      <button type="button" class="btn btn-ghost btn-sm" data-remove-row>×</button>
    </div>`;
}

function readFieldRows(container, prefix) {
  const rows = container.querySelectorAll(".field-row");
  const fields = [];
  for (const row of rows) {
    const name = row.querySelector(`.${prefix}-field-name`)?.value.trim();
    const type = row.querySelector(`.${prefix}-field-type`)?.value;
    if (name) fields.push({ name, type });
  }
  return fields;
}

function renderFieldDefs(fields) {
  if (!fields.length) return '<span class="muted">—</span>';
  return fields
    .map((f) => `<code>${escapeHtml(f.name)}</code>: ${escapeHtml(f.type)}`)
    .join(", ");
}

function renderProjects() {
  const projects = state.projects;
  projectCount.textContent = String(projects.length);
  projectsEmpty.hidden = projects.length > 0;

  if (projects.length === 0) {
    projectList.innerHTML = "";
    schemaSection.hidden = true;
    state.activeProjectId = null;
    localStorage.removeItem(STORAGE_PROJECT);
    return;
  }

  if (
    state.activeProjectId &&
    !projects.some((p) => p._id === state.activeProjectId)
  ) {
    state.activeProjectId = null;
    localStorage.removeItem(STORAGE_PROJECT);
  }

  projectList.innerHTML = projects
    .map(
      (p) => `
    <li class="project-item ${p._id === state.activeProjectId ? "active" : ""}" data-id="${escapeHtml(p._id)}" data-action="select">
      <div class="project-info">
        <span class="project-name">${escapeHtml(p.name)}</span>
        <span class="project-slug">${escapeHtml(p.slug)}</span>
      </div>
      ${
        p.role === "owner"
          ? `<button type="button" class="btn btn-ghost" data-action="delete" title="Удалить">×</button>`
          : `<span class="project-role">${escapeHtml(p.role)}</span>`
      }
    </li>`
    )
    .join("");

  if (!state.activeProjectId && projects[0]) {
    selectProject(projects[0]._id);
  } else if (state.activeProjectId) {
    void loadSchema();
  }
}

function selectProject(id) {
  state.activeProjectId = id;
  localStorage.setItem(STORAGE_PROJECT, id);
  renderProjects();
}

function renderSchema() {
  const project = state.projects.find((p) => p._id === state.activeProjectId);
  if (!project) {
    schemaSection.hidden = true;
    return;
  }

  schemaSection.hidden = false;
  activeProjectTitle.textContent = `Проект: ${project.name}`;

  tableCount.textContent = String(state.tables.length);
  fnCount.textContent = String(state.functions.length);

  tableList.innerHTML =
    state.tables.length === 0
      ? '<li class="schema-empty muted">Нет таблиц</li>'
      : state.tables
          .map(
            (t) => `
      <li class="schema-item" data-id="${escapeHtml(t._id)}" data-kind="table">
        <div>
          <strong>${escapeHtml(t.name)}</strong>
          <p class="schema-fields">${renderFieldDefs(t.fields)}</p>
        </div>
        <button type="button" class="btn btn-ghost" data-action="delete-table">×</button>
      </li>`
          )
          .join("");

  fnList.innerHTML =
    state.functions.length === 0
      ? '<li class="schema-empty muted">Нет функций</li>'
      : state.functions
          .map(
            (f) => `
      <li class="schema-item" data-id="${escapeHtml(f._id)}" data-kind="fn">
        <div>
          <strong><span class="kind-tag kind-${escapeHtml(f.kind)}">${escapeHtml(f.kind)}</span> ${escapeHtml(f.name)}</strong>
          <p class="schema-fields">${renderFieldDefs(f.args)}</p>
        </div>
        <button type="button" class="btn btn-ghost" data-action="delete-fn">×</button>
      </li>`
          )
          .join("");
}

async function loadSchema() {
  if (!state.activeProjectId) return;
  try {
    state.tables = await httpRun("tables:list", {
      projectId: state.activeProjectId,
    });
    state.functions = await httpRun("projectFns:list", {
      projectId: state.activeProjectId,
    });
    renderSchema();
  } catch (err) {
    setStatus("error", err.message);
  }
}

async function loadMe() {
  const me = await httpRun("auth:me", {});
  state.user = me.user;
  state.projects = me.projects;
  userLine.textContent = `${me.user.name} · ${me.user.email}`;
  renderProjects();
  showApp();
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === tab);
  });
  const loginForm = $("#form-login");
  const registerForm = $("#form-register");
  loginForm.hidden = tab !== "login";
  registerForm.hidden = tab !== "register";
}

document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchAuthTab(tab.dataset.tab));
});

$("#form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    const res = await httpRun("auth:login", {
      email: $("#login-email").value.trim(),
      password: $("#login-password").value,
    });
    state.token = res.token;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    await loadMe();
  } catch (err) {
    alert(err.message);
  }
});

$("#form-register").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("#reg-password").value;
  const password2 = $("#reg-password2").value;
  if (password !== password2) {
    alert("Пароли не совпадают");
    return;
  }
  try {
    const email = $("#reg-email").value.trim();
    const res = await httpRun("auth:register", {
      name: $("#reg-name").value.trim(),
      email,
      password,
    });
    state.token = res.token;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    await loadMe();
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
  state.activeProjectId = null;
  state.user = null;
  state.projects = [];
  state.tables = [];
  state.functions = [];
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem(STORAGE_PROJECT);
  showAuth();
  setStatus("", "Готов");
});

$("#form-new-project").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#new-project-name").value.trim();
  if (!name) return;
  try {
    const p = await httpRun("projects:create", { name });
    $("#new-project-name").value = "";
    await loadMe();
    selectProject(p._id);
  } catch (err) {
    alert(err.message);
  }
});

projectList.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest("[data-action='delete']");
  if (deleteBtn) {
    e.stopPropagation();
    const item = deleteBtn.closest(".project-item");
    if (!item) return;
    if (!confirm("Удалить проект?")) return;
    try {
      await httpRun("projects:remove", { projectId: item.dataset.id });
      if (state.activeProjectId === item.dataset.id) {
        state.activeProjectId = null;
        localStorage.removeItem(STORAGE_PROJECT);
      }
      await loadMe();
    } catch (err) {
      alert(err.message);
    }
    return;
  }

  const item = e.target.closest("[data-action='select']");
  if (item) selectProject(item.dataset.id);
});

$("#btn-add-table-field").addEventListener("click", () => {
  tableFields.insertAdjacentHTML("beforeend", fieldRowHtml("table"));
});

$("#btn-add-fn-arg").addEventListener("click", () => {
  fnArgs.insertAdjacentHTML("beforeend", fieldRowHtml("fn"));
});

tableFields.addEventListener("click", (e) => {
  if (e.target.closest("[data-remove-row]")) {
    e.target.closest(".field-row")?.remove();
  }
});

fnArgs.addEventListener("click", (e) => {
  if (e.target.closest("[data-remove-row]")) {
    e.target.closest(".field-row")?.remove();
  }
});

$("#form-new-table").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fields = readFieldRows(tableFields, "table");
  if (fields.length === 0) {
    alert("Добавьте хотя бы одно поле");
    return;
  }
  try {
    await httpRun("tables:create", {
      name: $("#table-name").value.trim(),
      fields,
      projectId: state.activeProjectId,
    });
    $("#table-name").value = "";
    tableFields.innerHTML = "";
    tableFields.insertAdjacentHTML("beforeend", fieldRowHtml("table"));
    await loadSchema();
  } catch (err) {
    alert(err.message);
  }
});

$("#form-new-fn").addEventListener("submit", async (e) => {
  e.preventDefault();
  const args = readFieldRows(fnArgs, "fn");
  try {
    await httpRun("projectFns:create", {
      name: $("#fn-name").value.trim(),
      kind: $("#fn-kind").value,
      args,
      projectId: state.activeProjectId,
    });
    $("#fn-name").value = "";
    fnArgs.innerHTML = "";
    await loadSchema();
  } catch (err) {
    alert(err.message);
  }
});

tableList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='delete-table']");
  if (!btn) return;
  const id = btn.closest(".schema-item")?.dataset.id;
  if (!id || !confirm("Удалить таблицу?")) return;
  try {
    await httpRun("tables:remove", { id });
    await loadSchema();
  } catch (err) {
    alert(err.message);
  }
});

fnList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='delete-fn']");
  if (!btn) return;
  const id = btn.closest(".schema-item")?.dataset.id;
  if (!id || !confirm("Удалить функцию?")) return;
  try {
    await httpRun("projectFns:remove", { id });
    await loadSchema();
  } catch (err) {
    alert(err.message);
  }
});

tableFields.insertAdjacentHTML("beforeend", fieldRowHtml("table"));

// Сразу показываем форму — не ждём ответа сервера
showAuth();
switchAuthTab("login");
setStatus("", "Подключение…");

fetchWithTimeout(apiUrl("/api/health"))
  .then(async (r) => {
    if (!r.ok) throw new Error("offline");
    if (state.token) {
      try {
        await loadMe();
      } catch {
        localStorage.removeItem(STORAGE_TOKEN);
        localStorage.removeItem(STORAGE_PROJECT);
        state.token = null;
        state.activeProjectId = null;
        showAuth();
        switchAuthTab("login");
        setStatus("", "Войдите снова");
      }
    } else {
      setStatus("", "Готов");
    }
  })
  .catch(() => {
    showAuth();
    switchAuthTab("login");
    setStatus("error", "Сервер не отвечает");
  });
