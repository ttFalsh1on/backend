const CFG = window.FLEX_CONFIG ?? { apiBase: "", httpOnly: false };
const API = (CFG.apiBase || "").replace(/\/$/, "");
const FETCH_TIMEOUT_MS = 12000;

const STORAGE_TOKEN = "flex_token";
const STORAGE_PROJECT = "flex_project_id";
const STORAGE_PASSWORD = "flex_password";

const FIELD_TYPES = ["string", "number", "boolean", "id"];

const $ = (sel) => document.querySelector(sel);

const authScreen = $("#auth-screen");
const appScreen = $("#app-screen");
const statusEl = $("#status");
const statusText = statusEl.querySelector(".status-text");
const btnLogout = $("#btn-logout");
const btnProfileAvatar = $("#btn-profile-avatar");
const avatarInitials = $("#avatar-initials");
const btnBackFromProfile = $("#btn-back-from-profile");
const viewProfile = $("#view-profile");
const profileDetails = $("#profile-details");
const profilePasswordHint = $("#profile-password-hint");
const projectList = $("#project-list");
const projectCount = $("#project-count");
const projectsEmpty = $("#projects-empty");
const viewProjects = $("#view-projects");
const viewProject = $("#view-project");
const btnBackProjects = $("#btn-back-projects");
const activeProjectTitle = $("#active-project-title");
const activeProjectSlug = $("#active-project-slug");
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
  document.documentElement.classList.remove("has-session");
  authScreen.hidden = false;
  appScreen.hidden = true;
  btnLogout.hidden = true;
  btnProfileAvatar.hidden = true;
}

function showApp() {
  document.documentElement.classList.add("has-session");
  authScreen.hidden = true;
  appScreen.hidden = false;
  btnLogout.hidden = false;
  btnProfileAvatar.hidden = false;
  updateHeaderAvatar();
  setStatus("connected", "В сети");
}

function userInitials(user) {
  if (!user) return "?";
  const name = user.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }
  return (user.email?.[0] ?? "?").toUpperCase();
}

function updateHeaderAvatar() {
  if (!state.user) {
    avatarInitials.textContent = "?";
    btnProfileAvatar.classList.remove("active");
    return;
  }
  avatarInitials.textContent = userInitials(state.user);
  btnProfileAvatar.title = state.user.name || state.user.email;
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

function setSessionPassword(password) {
  if (password) {
    sessionStorage.setItem(STORAGE_PASSWORD, password);
  } else {
    sessionStorage.removeItem(STORAGE_PASSWORD);
  }
}

function getSessionPassword() {
  try {
    return sessionStorage.getItem(STORAGE_PASSWORD) ?? "";
  } catch {
    return "";
  }
}

const PW_TOGGLE_ICONS = `<svg class="pw-icon pw-icon-show" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><svg class="pw-icon pw-icon-hide" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function ensureToggleIcons(btn) {
  if (!btn.querySelector(".pw-icon")) {
    btn.insertAdjacentHTML("beforeend", PW_TOGGLE_ICONS);
  }
}

function initPasswordToggles(root = document) {
  root.querySelectorAll(".pw-toggle").forEach((btn) => {
    ensureToggleIcons(btn);
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.classList.toggle("is-visible", show);
      btn.setAttribute("aria-label", show ? "Скрыть пароль" : "Показать пароль");
    });
  });
}

function setProfileAvatarActive(active) {
  btnProfileAvatar.classList.toggle("active", active);
}

function showProfileView() {
  viewProfile.hidden = false;
  viewProjects.hidden = true;
  viewProject.hidden = true;
  setProfileAvatarActive(true);
  renderProfile();
}

function showProjectsView() {
  viewProfile.hidden = true;
  viewProjects.hidden = false;
  viewProject.hidden = true;
  setProfileAvatarActive(false);
}

function showProjectView() {
  viewProfile.hidden = true;
  viewProjects.hidden = true;
  viewProject.hidden = false;
  setProfileAvatarActive(false);
}

function renderProfile() {
  const user = state.user;
  if (!user) {
    profileDetails.innerHTML = "";
    return;
  }

  const password = getSessionPassword();
  const passwordValue = password || "••••••••";
  const passwordMissing = !password;

  profilePasswordHint.hidden = !passwordMissing;

  profileDetails.innerHTML = `
    <div class="profile-row">
      <dt>ID</dt>
      <dd><code>${escapeHtml(user._id)}</code></dd>
    </div>
    <div class="profile-row">
      <dt>Имя</dt>
      <dd>${escapeHtml(user.name)}</dd>
    </div>
    <div class="profile-row">
      <dt>Почта</dt>
      <dd>${escapeHtml(user.email)}</dd>
    </div>
    <div class="profile-row">
      <dt>Пароль</dt>
      <dd>
        <div class="password-wrap password-wrap-inline">
          <input
            type="password"
            id="profile-password-display"
            class="profile-password-input"
            value="${escapeHtml(passwordValue)}"
            readonly
            ${passwordMissing ? 'placeholder="Войдите снова, чтобы увидеть"' : ""}
          />
          <button type="button" class="pw-toggle" data-target="profile-password-display" aria-label="Показать пароль"></button>
        </div>
      </dd>
    </div>
    <div class="profile-row">
      <dt>Проектов</dt>
      <dd>${state.projects.length}</dd>
    </div>`;

  initPasswordToggles(profileDetails);
  updateHeaderAvatar();
}

function renderProjects() {
  const projects = state.projects;
  projectCount.textContent = String(projects.length);
  projectsEmpty.hidden = projects.length > 0;

  if (projects.length === 0) {
    projectList.innerHTML = "";
    state.activeProjectId = null;
    localStorage.removeItem(STORAGE_PROJECT);
    showProjectsView();
    return;
  }

  if (
    state.activeProjectId &&
    !projects.some((p) => p._id === state.activeProjectId)
  ) {
    state.activeProjectId = null;
    localStorage.removeItem(STORAGE_PROJECT);
    showProjectsView();
  }

  projectList.innerHTML = projects
    .map(
      (p) => `
    <li class="project-item" data-id="${escapeHtml(p._id)}">
      <div class="project-info">
        <span class="project-name">${escapeHtml(p.name)}</span>
        <span class="project-slug">${escapeHtml(p.slug)}</span>
      </div>
      <div class="project-actions">
        <button type="button" class="btn btn-primary btn-sm" data-action="open">Открыть</button>
        ${
          p.role === "owner"
            ? `<button type="button" class="btn btn-ghost btn-sm" data-action="delete" title="Удалить">×</button>`
            : `<span class="project-role">${escapeHtml(p.role)}</span>`
        }
      </div>
    </li>`
    )
    .join("");
}

async function openProject(id) {
  state.activeProjectId = id;
  localStorage.setItem(STORAGE_PROJECT, id);
  showProjectView();
  const project = state.projects.find((p) => p._id === id);
  if (project) {
    activeProjectTitle.textContent = project.name;
    activeProjectSlug.textContent = project.slug;
  }
  tableList.innerHTML = '<li class="schema-empty muted">Загрузка…</li>';
  fnList.innerHTML = '<li class="schema-empty muted">Загрузка…</li>';
  await loadSchema();
}

function renderSchema() {
  const project = state.projects.find((p) => p._id === state.activeProjectId);
  if (!project) {
    showProjectsView();
    return;
  }

  activeProjectTitle.textContent = project.name;
  activeProjectSlug.textContent = project.slug;

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
  renderProjects();
  showApp();

  const savedId = localStorage.getItem(STORAGE_PROJECT);
  const reopen = savedId && state.projects.some((p) => p._id === savedId);
  if (reopen) {
    await openProject(savedId);
  } else {
    showProjectsView();
  }
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
  const password = $("#login-password").value;
  try {
    const res = await httpRun("auth:login", {
      email: $("#login-email").value.trim(),
      password,
    });
    state.token = res.token;
    localStorage.setItem(STORAGE_TOKEN, state.token);
    setSessionPassword(password);
    await loadMe();
  } catch (err) {
    const msg = err.message || "Ошибка входа";
    if (msg.includes("не найден") || msg.includes("зарегистрируйтесь")) {
      switchAuthTab("register");
      setStatus("auth", msg);
      return;
    }
    alert(msg);
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
    setSessionPassword(password);
    await loadMe();
  } catch (err) {
    alert(err.message);
  }
});

btnProfileAvatar.addEventListener("click", () => {
  if (viewProfile.hidden) {
    showProfileView();
  } else {
    showProjectsView();
  }
});

btnBackFromProfile.addEventListener("click", () => {
  showProjectsView();
});

$("#form-change-password").addEventListener("submit", async (e) => {
  e.preventDefault();
  const currentPassword = $("#pw-current").value;
  const newPassword = $("#pw-new").value;
  const newPassword2 = $("#pw-new2").value;
  if (newPassword !== newPassword2) {
    alert("Новые пароли не совпадают");
    return;
  }
  try {
    await httpRun("auth:changePassword", { currentPassword, newPassword });
    setSessionPassword(newPassword);
    $("#form-change-password").reset();
    renderProfile();
    alert("Пароль изменён");
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
  setSessionPassword(null);
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
    await openProject(p._id);
  } catch (err) {
    alert(err.message);
  }
});

projectList.addEventListener("click", async (e) => {
  const openBtn = e.target.closest("[data-action='open']");
  if (openBtn) {
    const item = openBtn.closest(".project-item");
    if (item) await openProject(item.dataset.id);
    return;
  }

  const deleteBtn = e.target.closest("[data-action='delete']");
  if (deleteBtn) {
    const item = deleteBtn.closest(".project-item");
    if (!item) return;
    if (!confirm("Удалить проект?")) return;
    try {
      await httpRun("projects:remove", { projectId: item.dataset.id });
      if (state.activeProjectId === item.dataset.id) {
        state.activeProjectId = null;
        localStorage.removeItem(STORAGE_PROJECT);
        showProjectsView();
      }
      await loadMe();
    } catch (err) {
      alert(err.message);
    }
  }
});

btnBackProjects.addEventListener("click", () => {
  showProjectsView();
  state.activeProjectId = null;
  localStorage.removeItem(STORAGE_PROJECT);
});

initPasswordToggles();

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

if (state.token) {
  showApp();
  setStatus("", "Загрузка…");
} else {
  showAuth();
  switchAuthTab("login");
  setStatus("", "Готов");
}

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
        document.documentElement.classList.remove("has-session");
        showAuth();
        switchAuthTab("login");
        setStatus("", "Сессия истекла — войдите снова");
      }
    }
  })
  .catch(() => {
    if (!state.token) {
      showAuth();
      switchAuthTab("login");
      setStatus("error", "Сервер не отвечает");
    } else {
      setStatus("error", "Нет связи с сервером");
    }
  });
