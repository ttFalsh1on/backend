/**
 * Безопасный разбор ответа Flex API (для вашего фронтенда).
 * Вставьте в проект, который вызывает POST /api/run
 */
export async function flexApiRun(
  baseUrl: string,
  path: string,
  args: Record<string, unknown> = {},
  options?: { token?: string; projectId?: string }
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options?.token) headers.Authorization = `Bearer ${options.token}`;
  if (options?.projectId) headers["X-Project-Id"] = options.projectId;

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/run`, {
    method: "POST",
    headers,
    body: JSON.stringify({ path, args }),
  });

  const text = await res.text();
  let data: { value?: unknown; error?: string };

  try {
    data = JSON.parse(text) as { value?: unknown; error?: string };
  } catch {
    throw new Error(
      `Сервер вернул не JSON (${res.status}): ${text.slice(0, 150)}`
    );
  }

  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }

  return data.value;
}
