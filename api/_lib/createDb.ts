import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createJsonDatabase, type JsonFlexDatabase } from "@flex/core";
import type { SchemaDefinition } from "@flex/core";

const BLOB_KEY = "flex-store.json";

type StoreData = Record<string, Record<string, { data: Record<string, unknown>; creationTime: number }>>;

async function loadBlobStore(): Promise<StoreData> {
  const { head } = await import("@vercel/blob");
  try {
    const meta = await head(BLOB_KEY);
    const res = await fetch(meta.url);
    if (!res.ok) return {};
    return (await res.json()) as StoreData;
  } catch {
    return {};
  }
}

async function saveBlobStore(json: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_KEY, json, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function createApiDatabase(
  schema: SchemaDefinition
): Promise<JsonFlexDatabase> {
  const jsonPath =
    process.env.FLEX_DB_PATH ?? join("/tmp", "flex-store.json");
  mkdirSync(dirname(jsonPath), { recursive: true });

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
