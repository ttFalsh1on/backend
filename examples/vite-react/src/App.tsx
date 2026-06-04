import { useState } from "react";
import { useFlexQuery, useFlexMutation } from "@flex/react";

interface Todo {
  _id: string;
  text: string;
  completed: boolean;
}

export function App() {
  const { data: todos = [], loading, error } = useFlexQuery<Todo[]>(
    "functions:list",
    {}
  );
  const { mutate: add, loading: adding } = useFlexMutation<string, { text: string }>(
    "functions:add"
  );
  const { mutate: toggle } = useFlexMutation("functions:toggle");
  const [text, setText] = useState("");

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await add({ text: text.trim() });
    setText("");
  }

  if (error) {
    return (
      <div style={styles.page}>
        <p style={{ color: "#f87171" }}>
          Не удалось подключиться к Flex. Запустите сервер: npm run dev в examples/todo
        </p>
        <code>{error.message}</code>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Внешний проект → Flex</h1>
      <p style={styles.sub}>Vite + React + @flex/react (real-time)</p>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Новая задача"
          style={styles.input}
        />
        <button type="submit" disabled={adding} style={styles.btn}>
          Добавить
        </button>
      </form>

      {loading ? (
        <p>Загрузка…</p>
      ) : (
        <ul style={styles.list}>
          {todos.map((t) => (
            <li key={t._id} style={styles.item}>
              <button
                type="button"
                onClick={() => toggle({ id: t._id })}
                style={{
                  ...styles.check,
                  background: t.completed ? "#f59e42" : "transparent",
                }}
              />
              <span
                style={{
                  flex: 1,
                  textDecoration: t.completed ? "line-through" : "none",
                  opacity: t.completed ? 0.6 : 1,
                }}
              >
                {t.text}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "system-ui, sans-serif",
    maxWidth: 480,
    margin: "2rem auto",
    padding: "0 1rem",
    color: "#e8eaef",
    background: "#0c0e12",
    minHeight: "100vh",
  },
  title: { fontSize: "1.5rem", marginBottom: 0 },
  sub: { color: "#8b92a8", fontSize: "0.85rem", marginTop: "0.25rem" },
  form: { display: "flex", gap: 8, marginTop: "1.5rem" },
  input: {
    flex: 1,
    padding: "0.6rem 0.8rem",
    borderRadius: 8,
    border: "1px solid #333",
    background: "#141820",
    color: "#fff",
  },
  btn: {
    padding: "0.6rem 1rem",
    borderRadius: 8,
    border: "none",
    background: "#f59e42",
    color: "#0c0e12",
    fontWeight: 600,
    cursor: "pointer",
  },
  list: { listStyle: "none", padding: 0, marginTop: "1rem" },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0.75rem",
    background: "#141820",
    borderRadius: 8,
    marginBottom: 6,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    border: "2px solid #8b92a8",
    cursor: "pointer",
  },
};
