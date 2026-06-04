/**
 * Подключение любого HTML-сайта к Flex Backend.
 * Скопируйте этот файл в свой проект и поменяйте FLEX_URL.
 */
const FLEX_URL = "http://localhost:3210";

document.getElementById("api-url").textContent = FLEX_URL;

const statusEl = document.getElementById("status");
const listEl = document.getElementById("list");
const form = document.getElementById("form");
const input = document.getElementById("input");

function setStatus(ok, text) {
  statusEl.className = `status ${ok ? "ok" : "err"}`;
  statusEl.textContent = text;
}

async function run(path, args = {}) {
  const res = await fetch(`${FLEX_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data.value;
}

function renderTodos(todos) {
  if (!todos?.length) {
    listEl.innerHTML = "<li style='opacity:.6'>Нет задач</li>";
    return;
  }
  listEl.innerHTML = todos
    .map(
      (t) => `
    <li class="${t.completed ? "done" : ""}" data-id="${t._id}">
      <div class="check" data-action="toggle" title="Выполнить"></div>
      <span style="flex:1">${escapeHtml(t.text)}</span>
      <button type="button" data-action="delete" title="Удалить">×</button>
    </li>`
    )
    .join("");
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

// Real-time через WebSocket
let ws;
function connectWs() {
  const wsUrl = FLEX_URL.replace(/^http/, "ws");
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setStatus(true, "Real-time подключён");
    ws.send(
      JSON.stringify({
        type: "subscribe",
        subscriptionId: crypto.randomUUID(),
        path: "functions:list",
        args: {},
      })
    );
  };

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "subscription_update") {
      renderTodos(msg.value);
    }
  };

  ws.onclose = () => {
    setStatus(false, "Переподключение…");
    setTimeout(connectWs, 2000);
  };

  ws.onerror = () => setStatus(false, "Ошибка WebSocket");
}

function sendMutation(path, args) {
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
    ws.send(JSON.stringify({ type: "mutation", path, args }));
  });
}

listEl.addEventListener("click", async (e) => {
  const li = e.target.closest("li");
  if (!li?.dataset.id || ws?.readyState !== WebSocket.OPEN) return;
  const id = li.dataset.id;
  if (e.target.dataset.action === "toggle") {
    await sendMutation("functions:toggle", { id });
  }
  if (e.target.dataset.action === "delete") {
    await sendMutation("functions:remove", { id });
  }
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  if (ws?.readyState === WebSocket.OPEN) {
    await sendMutation("functions:add", { text });
  } else {
    await run("functions:add", { text });
    const todos = await run("functions:list");
    renderTodos(todos);
  }
});

// Проверка сервера
fetch(`${FLEX_URL}/api/health`)
  .then((r) => (r.ok ? connectWs() : Promise.reject()))
  .catch(() =>
    setStatus(
      false,
      "Сервер недоступен. Запустите: cd examples/todo && npx tsx src/server.ts"
    )
  );
