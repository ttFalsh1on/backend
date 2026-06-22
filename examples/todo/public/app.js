const CFG = window.FLEX_CONFIG ?? { apiBase: "", httpOnly: false };
const API = (CFG.apiBase || "").replace(/\/$/, "");

const STORAGE_TOKEN = "flex_token";

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

let state = {
  token: localStorage.getItem(STORAGE_TOKEN),
  user: null,
  projects: [],
};

function apiUrl(path) {
  return API ? `${API}${path}` : path;
}

function headers() {
  const h = { "Content-Type": "application/json" };
  if (state.token) h.Authorization = `Bearer ${state.token}`;
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
  setStatus("connected", "В сети");
}

function renderProjects() {
  const projects = state.projects;
  projectCount.textContent = String(projects.length);
  projectsEmpty.hidden = projects.length > 0;

  if (projects.length === 0) {
    projectList.innerHTML = "";
    return;
  }

  projectList.innerHTML = projects
    .map(
      (p) => `
    <li class="project-item" data-id="${escapeHtml(p._id)}">
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
}

async function loadMe() {
  const me = await httpRun("auth:me", {});
  state.user = me.user;
  state.projects = me.projects;
  userLine.textContent = `${me.user.name} · ${me.user.email}`;
  renderProjects();
  showApp();
}

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
    await loadMe();
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
  state.user = null;
  state.projects = [];
  localStorage.removeItem(STORAGE_TOKEN);
  showAuth();
  setStatus("", "Готов");
});

$("#form-new-project").addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = $("#new-project-name").value.trim();
  if (!name) return;
  try {
    await httpRun("projects:create", { name });
    $("#new-project-name").value = "";
    await loadMe();
  } catch (err) {
    alert(err.message);
  }
});

projectList.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action='delete']");
  if (!btn) return;
  const item = btn.closest(".project-item");
  if (!item) return;
  const id = item.dataset.id;
  if (!confirm("Удалить проект?")) return;
  try {
    await httpRun("projects:remove", { projectId: id });
    await loadMe();
  } catch (err) {
    alert(err.message);
  }
});

fetch(apiUrl("/api/health"))
  .then(async (r) => {
    if (!r.ok) throw new Error("offline");
    if (state.token) {
      try {
        await loadMe();
      } catch {
        localStorage.removeItem(STORAGE_TOKEN);
        state.token = null;
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
