import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const catalogPath = path.join(root, "data", "catalog.json");
const defaultStorePath = path.join(root, "data", "local-demo.json");
const storePath = () => process.env.LOCAL_STORE_PATH || defaultStorePath;

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function readStore() {
  const store = await readJson(storePath(), {});
  return {
    users: Array.isArray(store.users) ? store.users : [],
    sessions: Array.isArray(store.sessions) ? store.sessions : [],
    documents: Array.isArray(store.documents) ? store.documents : [],
    posts: Array.isArray(store.posts) ? store.posts : [],
    documentInteractions: Array.isArray(store.documentInteractions) ? store.documentInteractions : [],
  };
}

async function writeStore(store) {
  const target = storePath();
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function baseCatalog() {
  return readJson(catalogPath, []);
}

function byNewest(a, b) {
  return String(b.createdAt || b.date || "").localeCompare(String(a.createdAt || a.date || ""));
}

export async function listLocalDocuments({ ownerId, includeUnavailable = false } = {}) {
  const [catalog, store] = await Promise.all([baseCatalog(), readStore()]);
  return [...catalog, ...store.documents]
    .filter((doc) => (!ownerId || doc.ownerId === ownerId) && (includeUnavailable || doc.available === true))
    .sort(byNewest);
}

export async function getLocalDocument(documentId, includeUnavailable = false) {
  const documents = await listLocalDocuments({ includeUnavailable: true });
  const document = documents.find((doc) => doc.id === documentId);
  return document && (includeUnavailable || document.available === true) ? document : null;
}

export async function saveLocalDocument(document) {
  const store = await readStore();
  const id = document.id || `local-${crypto.randomUUID()}`;
  const index = store.documents.findIndex((item) => item.id === id);
  const current = index >= 0 ? store.documents[index] : {};
  const saved = { ...current, ...document, id };
  if (index >= 0) store.documents[index] = saved;
  else store.documents.push(saved);
  await writeStore(store);
  return saved;
}

export async function incrementLocalDownload(documentId) {
  const store = await readStore();
  const index = store.documents.findIndex((item) => item.id === documentId);
  if (index < 0) return;
  store.documents[index].downloadCount = Number(store.documents[index].downloadCount || 0) + 1;
  await writeStore(store);
}

export async function findLocalUserByEmail(email) {
  const store = await readStore();
  return store.users.find((user) => user.email === String(email || "").toLowerCase()) || null;
}

export async function getLocalUser(userId) {
  const store = await readStore();
  return store.users.find((user) => user.id === userId) || null;
}

export async function createLocalUser(data, id) {
  const store = await readStore();
  const user = { id: id || `user-${crypto.randomUUID()}`, ...data };
  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function createLocalSession(data) {
  const store = await readStore();
  const id = `session-${crypto.randomUUID()}`;
  store.sessions.push({ id, ...data });
  await writeStore(store);
  return id;
}

export async function getLocalSession(sessionId) {
  const store = await readStore();
  return store.sessions.find((session) => session.id === sessionId) || null;
}

export async function revokeLocalSession(sessionId) {
  const store = await readStore();
  const index = store.sessions.findIndex((session) => session.id === sessionId);
  if (index >= 0) {
    store.sessions[index] = { ...store.sessions[index], revoked: true, revokedAt: new Date().toISOString() };
    await writeStore(store);
  }
}

export async function saveLocalPost(post) {
  const store = await readStore();
  const id = post.id || `post-${crypto.randomUUID()}`;
  const saved = { id, ...post };
  const index = store.posts.findIndex((item) => item.id === id);
  if (index >= 0) store.posts[index] = saved;
  else store.posts.push(saved);
  await writeStore(store);
  return saved;
}

export async function listLocalTopContributors(limit = 5) {
  const store = await readStore();
  const users = new Map(store.users.filter((user) => user.status === "active").map((user) => [user.id, user]));
  const activity = new Map();
  for (const post of store.posts.filter((item) => item.status === "published")) {
    if (!users.has(post.authorId)) continue;
    const current = activity.get(post.authorId) || { postCount: 0, latestPostAt: "" };
    current.postCount += 1;
    current.latestPostAt = String(post.createdAt || "") > current.latestPostAt ? String(post.createdAt || "") : current.latestPostAt;
    activity.set(post.authorId, current);
  }
  return [...activity.entries()]
    .map(([userId, stats]) => ({
      userId,
      displayName: users.get(userId).displayName,
      avatarUrl: users.get(userId).avatarUrl || "",
      bio: users.get(userId).bio || "",
      role: users.get(userId).role,
      ...stats,
    }))
    .sort((a, b) => b.postCount - a.postCount || b.latestPostAt.localeCompare(a.latestPostAt))
    .slice(0, Math.min(10, Math.max(1, Number(limit) || 5)));
}

export async function saveLocalInteraction(userId, documentId, type, enabled) {
  const store = await readStore();
  const id = `${userId}_${documentId}_${type}`;
  store.documentInteractions = store.documentInteractions.filter((item) => item.id !== id);
  if (enabled) store.documentInteractions.push({ id, userId, documentId, type, createdAt: new Date().toISOString() });
  await writeStore(store);
  return { enabled: Boolean(enabled) };
}
