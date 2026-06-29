import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createJsonDatabase, type JsonFlexDatabase } from "@flex/core";
import type { SchemaDefinition } from "@flex/core";

const BLOB_KEY = "flex-store.json";

type StoreData = Record<string, Record<string, { data: Record<string, unknown>; creationTime: number }>>;

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

const BLOB_ACCESS = "private" as const;

async function loadBlobStore(): Promise<StoreData> {
  const { get } = await import("@vercel/blob");
  try {
    const result = await get(BLOB_KEY, { access: BLOB_ACCESS });
    if (result?.statusCode !== 200 || !result.stream) return {};
    const text = await new Response(result.stream).text();
    if (!text.trim()) return {};
    return JSON.parse(text) as StoreData;
  } catch {
    return {};
  }
}

async function saveBlobStore(json: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  try {
    await put(BLOB_KEY, json, {
      access: BLOB_ACCESS,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
  } catch (err) {
    console.error("Blob save failed:", err);
    throw new Error("Не удалось сохранить данные на сервере");
  }
}

export async function createApiDatabase(
  schema: SchemaDefinition
): Promise<JsonFlexDatabase> {
  const jsonPath =
    process.env.FLEX_DB_PATH ?? join("/tmp", "flex-store.json");
  mkdirSync(dirname(jsonPath), { recursive: true });

  if (blobEnabled()) {
    const initial = await loadBlobStore();
    writeFileSync(jsonPath, JSON.stringify(initial), "utf8");
    return createJsonDatabase(jsonPath, schema, {
      initialStore: initial,
      onPersist: async (json) => {
        writeFileSync(jsonPath, json, "utf8");
        await saveBlobStore(json);
      },
    });
  }

  return createJsonDatabase(jsonPath, schema);
}
