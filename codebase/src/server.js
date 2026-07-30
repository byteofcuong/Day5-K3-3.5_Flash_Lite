import "dotenv/config";
import bcrypt from "bcryptjs";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { fileURLToPath } from "node:url";
import { publicUser, requireAuth, signAccessToken } from "./auth.js";
import {
  createSession, createUser, findUserByEmail, getDocument, incrementDownload,
  isFirebaseConfigured, listDocuments, listTopContributors, revokeSession, saveDocument, saveInteraction, savePost,
} from "./firebase.js";
import { agentTools, buildAgentInstruction, executeAgentTool, mockSearch, parseAndValidate } from "./search.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repositoryRoot = path.resolve(root, "..");
const localCatalog = JSON.parse(await fs.readFile(path.join(root, "data/catalog.json"), "utf8"));
const traceDir = path.join(root, "traces");
const uploadDir = path.join(root, "uploads");
await fs.mkdir(uploadDir, { recursive: true });

const allowedExtensions = new Set([".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".png", ".jpg", ".jpeg", ".zip"]);
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_request, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, allowedExtensions.has(path.extname(file.originalname).toLowerCase())),
});

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use(express.static(path.join(root, "public")));
app.use("/uploads", express.static(uploadDir));
app.use("/library", express.static(path.join(repositoryRoot, "backend", "docs")));

const now = () => new Date().toISOString();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

async function writeTrace(trace) {
  await fs.mkdir(traceDir, { recursive: true });
  await fs.appendFile(path.join(traceDir, "ai-calls.jsonl"), `${JSON.stringify(trace)}\n`, "utf8");
}

async function loadCatalog() {
  return process.env.DATA_SOURCE === "firebase" ? listDocuments() : localCatalog.filter((doc) => doc.available);
}

async function loadDocument(id, includeUnavailable = false) {
  if (process.env.DATA_SOURCE === "firebase") return getDocument(id, includeUnavailable);
  return localCatalog.find((item) => item.id === id && (includeUnavailable || item.available)) || null;
}

async function geminiSearch(query, catalog) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY chưa được cấu hình.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const startedAt = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const contents = [{ role: "user", parts: [{ text: buildAgentInstruction(query) }] }];
  const toolTrace = [];
  let raw = "";
  for (let step = 0; step < 4; step++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents, tools: agentTools, toolConfig: { functionCallingConfig: { mode: "AUTO" } }, generationConfig: { temperature: 0.1 } }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message || `Gemini HTTP ${response.status}`);
    const modelContent = payload?.candidates?.[0]?.content;
    if (!modelContent) throw new Error("Gemini không trả content.");
    contents.push(modelContent);
    const calls = (modelContent.parts || []).filter((part) => part.functionCall).map((part) => part.functionCall);
    if (!calls.length) {
      raw = (modelContent.parts || []).map((part) => part.text || "").join("");
      break;
    }
    contents.push({
      role: "user",
      parts: calls.map((call) => {
        const result = executeAgentTool(call.name, call.args || {}, catalog);
        toolTrace.push({ step: step + 1, tool: call.name, args: call.args || {}, result });
        return { functionResponse: { name: call.name, response: { result }, id: call.id } };
      }),
    });
  }
  if (!raw) throw new Error("Agent vượt quá giới hạn 4 bước.");
  const result = parseAndValidate(raw, catalog);
  await writeTrace({ timestamp: now(), model, query, rawOutput: raw, validatedOutput: result, toolCalls: toolTrace, latencyMs: Date.now() - startedAt });
  return result;
}

app.post("/api/auth/register", async (request, response) => {
  try {
    const email = normalizeEmail(request.body.email);
    const displayName = String(request.body.displayName || "").trim();
    const password = String(request.body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: "Email không hợp lệ." });
    if (displayName.length < 2 || displayName.length > 60) return response.status(400).json({ error: "Tên phải có từ 2 đến 60 ký tự." });
    if (password.length < 8) return response.status(400).json({ error: "Mật khẩu cần ít nhất 8 ký tự." });
    if (await findUserByEmail(email)) return response.status(409).json({ error: "Email đã được sử dụng." });
    const createdAt = now();
    const user = await createUser({
      email, displayName, passwordHash: await bcrypt.hash(password, 12), role: "member",
      status: "active", avatarUrl: "", bio: "", documentCount: 0, createdAt, updatedAt: createdAt,
    });
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const sessionId = await createSession({ userId: user.id, revoked: false, createdAt, expiresAt, userAgent: request.headers["user-agent"] || "" });
    response.status(201).json({ token: signAccessToken(user, sessionId), user: publicUser(user) });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const user = await findUserByEmail(normalizeEmail(request.body.email));
  if (!user || !(await bcrypt.compare(String(request.body.password || ""), user.passwordHash))) {
    return response.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
  }
  if (user.status !== "active") return response.status(403).json({ error: "Tài khoản đã bị khóa." });
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const sessionId = await createSession({ userId: user.id, revoked: false, createdAt, expiresAt, userAgent: request.headers["user-agent"] || "" });
  response.json({ token: signAccessToken(user, sessionId), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => response.json({ user: publicUser(request.auth.user) }));
app.post("/api/auth/logout", requireAuth, async (request, response) => {
  await revokeSession(request.auth.sessionId);
  response.json({ message: "Đã đăng xuất." });
});

app.get("/api/catalog", async (request, response) => {
  try {
    const items = await loadCatalog();
    response.json({ items });
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
});

app.get("/api/contributors", async (request, response) => {
  try {
    const limit = Math.min(10, Math.max(1, Number(request.query.limit) || 5));
    response.json({ items: await listTopContributors(limit) });
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
});

app.get("/api/my/documents", requireAuth, async (request, response) => {
  response.json({ items: await listDocuments({ ownerId: request.auth.user.id, includeUnavailable: true }) });
});

app.get("/api/documents/:id", async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  response.json({ document });
});

app.get("/api/documents/:id/download", async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document?.fileUrl) return response.status(404).json({ error: "Tài liệu chưa có tệp." });
  if (process.env.DATA_SOURCE === "firebase") await incrementDownload(document.id).catch(() => {});
  response.redirect(document.fileUrl);
});

app.post("/api/documents", requireAuth, upload.single("file"), async (request, response) => {
  try {
    const title = String(request.body.title || "").trim();
    const summary = String(request.body.summary || "").trim();
    if (title.length < 3 || summary.length < 10) return response.status(400).json({ error: "Tiêu đề hoặc mô tả quá ngắn." });
    if (!request.file) return response.status(400).json({ error: "Bạn cần chọn một tệp hợp lệ, tối đa 20 MB." });
    const createdAt = now();
    const document = await saveDocument({
      title, summary, category: request.body.category || "Tài liệu",
      tags: String(request.body.tags || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10),
      level: request.body.level || "all", source: "community", date: createdAt.slice(0, 10),
      available: true, status: "published", ownerId: request.auth.user.id,
      ownerName: request.auth.user.displayName, fileName: request.file.originalname,
      fileUrl: `/uploads/${request.file.filename}`, mimeType: request.file.mimetype,
      sizeBytes: request.file.size, downloadCount: 0, createdAt, updatedAt: createdAt,
    });
    await savePost({
      authorId: request.auth.user.id, authorName: request.auth.user.displayName,
      documentId: document.id, title, content: summary, category: document.category,
      status: "published", likeCount: 0, commentCount: 0, createdAt, updatedAt: createdAt,
    });
    response.status(201).json({ document });
  } catch (error) {
    if (request.file) await fs.unlink(request.file.path).catch(() => {});
    response.status(500).json({ error: error.message });
  }
});

app.patch("/api/documents/:id/visibility", requireAuth, async (request, response) => {
  const document = await loadDocument(request.params.id, true);
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  if (document.ownerId !== request.auth.user.id && request.auth.user.role !== "admin") return response.status(403).json({ error: "Bạn không sở hữu tài liệu này." });
  const updated = await saveDocument({ id: document.id, available: Boolean(request.body.available), updatedAt: now() });
  response.json({ document: { ...document, ...updated } });
});

app.post("/api/documents/:id/bookmark", requireAuth, async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  response.json(await saveInteraction(request.auth.user.id, document.id, "bookmark", request.body.enabled !== false));
});

app.post("/api/search", async (request, response) => {
  const query = typeof request.body.query === "string" ? request.body.query.trim() : "";
  if (query.length < 2 || query.length > 500) return response.status(400).json({ error: "Truy vấn phải có từ 2 đến 500 ký tự." });
  try {
    const catalog = await loadCatalog();
    const mode = process.env.ENABLE_MOCK_AI === "true" ? "mock" : "gemini";
    const result = mode === "mock" ? mockSearch(query, catalog) : await geminiSearch(query, catalog);
    response.json({ ...result, mode, dataSource: process.env.DATA_SOURCE || "local" });
  } catch (error) {
    response.status(502).json({ error: error.message || "Không thể gọi AI." });
  }
});

app.get("/api/health", (_request, response) => response.json({
  status: "ok", aiConfigured: Boolean(process.env.GEMINI_API_KEY),
  mockMode: process.env.ENABLE_MOCK_AI === "true", dataSource: process.env.DATA_SOURCE || "local",
  firebaseConfigured: isFirebaseConfigured(),
}));

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) return response.status(400).json({ error: error.code === "LIMIT_FILE_SIZE" ? "Tệp vượt quá 20 MB." : error.message });
  response.status(500).json({ error: error.message || "Lỗi máy chủ." });
});

const port = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== "test") app.listen(port, () => console.log(`VShare: http://localhost:${port}`));
export { app, localCatalog };
