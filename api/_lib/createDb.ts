import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { createJsonDatabase, type JsonFlexDatabase } from "@flex/core";
import type { SchemaDefinition } from "@flex/core";
import type { BlobAccessType } from "@vercel/blob";

const BLOB_KEY = "flex-store.json";

type StoreData = Record<string, Record<string, { data: Record<string, unknown>; creationTime: number }>>;

let resolvedAccess: BlobAccessType | null = null;

function blobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function blobOptions(access: BlobAccessType) {
  return {
    access,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...(process.env.BLOB_STORE_ID ? { storeId: process.env.BLOB_STORE_ID } : {}),
  };
}

async function withBlobAccess<T>(
  fn: (access: BlobAccessType) => Promise<T>
): Promise<T> {
  if (resolvedAccess) {
    return fn(resolvedAccess);
  }

  const modes: BlobAccessType[] = ["private", "public"];
  let lastErr: unknown;

  for (const access of modes) {
    try {
      const result = await fn(access);
      resolvedAccess = access;
      return result;
    } catch (err) {
      lastErr = err;
      console.error(`Blob ${access} failed:`, err);
    }
  }

  throw lastErr ?? new Error("Blob unavailable");
}

async function loadBlobStore(): Promise<StoreData> {
  const { get } = await import("@vercel/blob");
  try {
    return await withBlobAccess(async (access) => {
      const result = await get(BLOB_KEY, blobOptions(access));
      if (!result?.stream) return {};
      const text = await new Response(result.stream).text();
      if (!text.trim()) return {};
      return JSON.parse(text) as StoreData;
    });
  } catch {
    return {};
  }
}

async function saveBlobStore(json: string): Promise<void> {
  const { put } = await import("@vercel/blob");
  try {
    await withBlobAccess((access) => put(BLOB_KEY, json, blobOptions(access)));
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
