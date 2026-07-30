import fs from "node:fs/promises";
import path from "node:path";
import { config, paths } from "../config/env.js";

/**
 * File-backed document store. The whole database is one JSON file kept in
 * memory; writes are debounced and flushed atomically (temp file + rename) so a
 * crash mid-write cannot leave a truncated db.json behind.
 *
 * Deliberately not a real database: this prototype only needs durability across
 * restarts, not concurrency or query planning.
 */

const FLUSH_DELAY_MS = 120;

let state = null;
let flushTimer = null;
let pendingFlush = null;

function emptyState() {
  return { meta: { version: 1, createdAt: new Date().toISOString() }, collections: {} };
}

async function atomicWrite(file, contents) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(temp, contents, "utf8");
  await fs.rename(temp, file);
}

export async function loadStore(seedFactory) {
  if (state) return state;
  try {
    state = JSON.parse(await fs.readFile(paths.dbFile, "utf8"));
    if (!state.collections) state = emptyState();
  } catch {
    state = emptyState();
    if (typeof seedFactory === "function") {
      state.collections = await seedFactory();
      await flush();
    }
  }
  return state;
}

/** Resets the in-memory handle. Used by tests to force a reload. */
export function resetStore() {
  state = null;
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  pendingFlush = null;
}

export function collection(name) {
  if (!state) throw new Error("Store chưa được khởi tạo. Gọi loadStore() trước.");
  if (!state.collections[name]) state.collections[name] = [];
  return state.collections[name];
}

/** Debounced persist — call after every mutation, batching is handled here. */
export function persist() {
  if (config.isTest) return Promise.resolve();
  if (flushTimer) clearTimeout(flushTimer);
  pendingFlush = new Promise((resolve) => {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flush().then(resolve).catch((error) => {
        console.error("[store] Không ghi được db.json:", error.message);
        resolve();
      });
    }, FLUSH_DELAY_MS);
  });
  return pendingFlush;
}

export async function flush() {
  if (!state) return;
  await atomicWrite(paths.dbFile, JSON.stringify(state, null, 2));
}

/** Flushes any debounced write immediately — used on graceful shutdown. */
export async function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flush();
}
