import "dotenv/config";
import bcrypt from "bcryptjs";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";
import { PDFParse } from "pdf-parse";
import { fileURLToPath } from "node:url";
import { publicUser, requireAuth, signAccessToken } from "./auth.js";
import {
  createSession, createUser, findUserByEmail, getDocument, incrementDownload,
  isFirebaseConfigured, listDocuments, listTopContributors, revokeSession, saveDocument, saveInteraction, savePost,
} from "./firebase.js";
import {
  createLocalSession, createLocalUser, findLocalUserByEmail, getLocalDocument, incrementLocalDownload,
  listLocalDocuments, listLocalTopContributors, revokeLocalSession, saveLocalDocument, saveLocalInteraction, saveLocalPost,
} from "./local-store.js";
import { agentTools, assessQueryIntent, buildAgentInstruction, executeAgentTool, mockSearch, parseAndValidate } from "./search.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const repositoryRoot = path.resolve(root, "..");
const localCatalog = JSON.parse(await fs.readFile(path.join(root, "data/catalog.json"), "utf8"));
const traceDir = path.join(root, "traces");
const uploadDir = path.join(root, "uploads");
const libraryDir = path.join(repositoryRoot, "backend", "docs");
const maxExtractedContentChars = 60000;
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
app.use("/library", express.static(libraryDir));

const now = () => new Date().toISOString();
const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const useFirebaseData = () => process.env.DATA_SOURCE === "firebase";
const documentApi = () => useFirebaseData()
  ? { listDocuments, getDocument, saveDocument, incrementDownload, saveInteraction, savePost, listTopContributors }
  : {
      listDocuments: listLocalDocuments,
      getDocument: getLocalDocument,
      saveDocument: saveLocalDocument,
      incrementDownload: incrementLocalDownload,
      saveInteraction: saveLocalInteraction,
      savePost: saveLocalPost,
      listTopContributors: listLocalTopContributors,
    };
const authApi = () => useFirebaseData()
  ? { findUserByEmail, createUser, createSession, revokeSession }
  : { findUserByEmail: findLocalUserByEmail, createUser: createLocalUser, createSession: createLocalSession, revokeSession: revokeLocalSession };
const publicDocument = (document) => {
  const { content, ...safe } = document;
  return { ...safe, hasContent: Boolean(String(content || "").trim()) };
};

async function writeTrace(trace) {
  await fs.mkdir(traceDir, { recursive: true });
  await fs.appendFile(path.join(traceDir, "ai-calls.jsonl"), `${JSON.stringify(trace)}\n`, "utf8");
}

async function loadCatalog() {
  return documentApi().listDocuments();
}

async function loadDocument(id, includeUnavailable = false) {
  return documentApi().getDocument(id, includeUnavailable);
}

function safeFilePath(baseDir, urlPath) {
  const name = path.basename(decodeURIComponent(String(urlPath || "")));
  const resolved = path.resolve(baseDir, name);
  return resolved.startsWith(path.resolve(baseDir)) ? resolved : null;
}

function resolveDocumentFilePath(document) {
  const fileUrl = String(document.fileUrl || "");
  if (fileUrl.startsWith("/uploads/")) return safeFilePath(uploadDir, fileUrl);
  if (fileUrl.startsWith("/library/")) return safeFilePath(libraryDir, fileUrl);
  if (document.fileName && document.source === "official") return safeFilePath(libraryDir, document.fileName);
  return null;
}

async function extractPdfText(filePath) {
  const data = await fs.readFile(filePath);
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    return String(result.text || "").replace(/\r\n/g, "\n").trim();
  } finally {
    await parser.destroy();
  }
}

async function extractTextFromFile(filePath, fileName = "", mimeType = "") {
  const ext = path.extname(fileName || filePath).toLowerCase();
  const mime = String(mimeType || "").toLowerCase();
  if (ext === ".txt" || mime.startsWith("text/")) return fs.readFile(filePath, "utf8");
  if (ext === ".pdf" || mime.includes("pdf")) return extractPdfText(filePath);
  return "";
}

async function readUploadedContent(file) {
  const content = await extractTextFromFile(file.path, file.originalname, file.mimetype).catch(() => "");
  return content.trim() ? content.slice(0, maxExtractedContentChars) : undefined;
}

async function ensureDocumentContent(document) {
  if (!document || String(document.content || "").trim()) return document;
  const filePath = resolveDocumentFilePath(document);
  if (!filePath) return document;
  const content = await extractTextFromFile(filePath, document.fileName, document.mimeType).catch(() => "");
  const trimmed = content.trim().slice(0, maxExtractedContentChars);
  if (!trimmed) return document;
  const updated = await documentApi().saveDocument({ id: document.id, content: trimmed, contentExtractedAt: now(), updatedAt: now() }).catch(() => null);
  return { ...document, ...(updated || {}), content: trimmed };
}


function friendlyAiError(error) {
  const raw = String(error?.message || error || "");
  const lower = raw.toLowerCase();
  const retryMatch = raw.match(/retry\s+in\s+([\d.]+)/i) || raw.match(/retryDelay["']?\s*[:=]\s*["']?([\d.]+)s?/i);
  const retryText = retryMatch ? ` Bạn thử lại sau khoảng ${Math.ceil(Number(retryMatch[1]))} giây.` : " Bạn thử lại sau ít phút.";
  if (lower.includes("quota") || lower.includes("rate") || lower.includes("resource_exhausted") || lower.includes("too many requests") || lower.includes("429")) {
    return { status: 429, code: "AI_RATE_LIMITED", message: `AI Agent đang tạm hết lượt xử lý.${retryText}` };
  }
  if (lower.includes("api key") || lower.includes("permission") || lower.includes("unauthorized") || lower.includes("forbidden") || lower.includes("401") || lower.includes("403")) {
    return { status: 503, code: "AI_NOT_CONFIGURED", message: "AI Agent chưa sẵn sàng do cấu hình kết nối. Bạn vẫn có thể xem tài liệu và thử lại sau." };
  }
  if (lower.includes("fetch") || lower.includes("network") || lower.includes("econn") || lower.includes("timeout") || lower.includes("503") || lower.includes("504")) {
    return { status: 503, code: "AI_TEMPORARY_UNAVAILABLE", message: "AI Agent đang kết nối không ổn định. Bạn thử lại sau ít phút." };
  }
  if (lower.includes("vượt quá giới hạn 4 bước")) {
    return { status: 504, code: "AI_STEP_LIMIT", message: "AI Agent cần quá nhiều bước để xử lý câu hỏi này. Bạn hãy hỏi cụ thể hơn hoặc chọn một phần nhỏ trong tài liệu." };
  }
  if (lower.includes("invalid ai status") || lower.includes("json") || lower.includes("không trả content")) {
    return { status: 502, code: "AI_BAD_RESPONSE", message: "AI Agent trả về kết quả chưa đúng định dạng. Bạn thử hỏi lại ngắn gọn hơn." };
  }
  return { status: 502, code: "AI_UNAVAILABLE", message: "AI Agent chưa thể xử lý yêu cầu lúc này. Bạn thử lại sau hoặc mở tài liệu để đọc trực tiếp." };
}
async function geminiSearch(query, catalog, contextDocumentId = null) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY chưa được cấu hình.");
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const startedAt = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;
  const contents = [{ role: "user", parts: [{ text: buildAgentInstruction(query, contextDocumentId) }] }];
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
        const args = call.args || {};
        const requestedDocumentId = typeof args.document_id === "string" ? args.document_id : "";
        const blockedByContext = contextDocumentId && ["get_document", "get_document_content"].includes(call.name) && requestedDocumentId !== contextDocumentId;
        const result = blockedByContext
          ? { error: "CONTEXT_DOCUMENT_ONLY", documentId: contextDocumentId }
          : executeAgentTool(call.name, args, catalog);
        toolTrace.push({ step: step + 1, tool: call.name, args, result });
        return { functionResponse: { name: call.name, response: { result }, id: call.id } };
      }),
    });
  }
  if (!raw) throw new Error("Agent vượt quá giới hạn 4 bước.");
  let result = parseAndValidate(raw, catalog);
  if (contextDocumentId && ["summary", "answer"].includes(result.status)) {
    const contextDoc = catalog.find((doc) => doc.id === contextDocumentId);
    result = {
      ...result,
      results: [],
      sources: contextDoc ? [{ documentId: contextDoc.id, title: contextDoc.title }] : [],
    };
  }
  const steps = toolTrace.map((call) => {
    const resultValue = call.result || {};
    const size = typeof resultValue.content === "string" ? ` · ${resultValue.content.length} ký tự` : Array.isArray(resultValue) ? ` · ${resultValue.length} kết quả` : "";
    return { kind: "tool", label: call.tool, detail: `Bước ${call.step}: gọi ${call.tool}${size}.` };
  });
  steps.push({ kind: "final", label: "compose_final_answer", detail: "Tổng hợp kết quả tool và trả lời bằng tiếng Việt." });
  await writeTrace({ timestamp: now(), model, query, rawOutput: raw, validatedOutput: result, toolCalls: toolTrace, latencyMs: Date.now() - startedAt });
  return { ...result, steps };
}

app.post("/api/auth/register", async (request, response) => {
  try {
    const email = normalizeEmail(request.body.email);
    const displayName = String(request.body.displayName || "").trim();
    const password = String(request.body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return response.status(400).json({ error: "Email không hợp lệ." });
    if (displayName.length < 2 || displayName.length > 60) return response.status(400).json({ error: "Tên phải có từ 2 đến 60 ký tự." });
    if (password.length < 8) return response.status(400).json({ error: "Mật khẩu cần ít nhất 8 ký tự." });
    const auth = authApi();
    if (await auth.findUserByEmail(email)) return response.status(409).json({ error: "Email đã được sử dụng." });
    const createdAt = now();
    const user = await auth.createUser({
      email, displayName, passwordHash: await bcrypt.hash(password, 12), role: "member",
      status: "active", avatarUrl: "", bio: "", documentCount: 0, createdAt, updatedAt: createdAt,
    });
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const sessionId = await auth.createSession({ userId: user.id, revoked: false, createdAt, expiresAt, userAgent: request.headers["user-agent"] || "" });
    response.status(201).json({ token: signAccessToken(user, sessionId), user: publicUser(user) });
  } catch (error) {
    response.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (request, response) => {
  const auth = authApi();
  const user = await auth.findUserByEmail(normalizeEmail(request.body.email));
  if (!user || !(await bcrypt.compare(String(request.body.password || ""), user.passwordHash))) {
    return response.status(401).json({ error: "Email hoặc mật khẩu không đúng." });
  }
  if (user.status !== "active") return response.status(403).json({ error: "Tài khoản đã bị khóa." });
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const sessionId = await auth.createSession({ userId: user.id, revoked: false, createdAt, expiresAt, userAgent: request.headers["user-agent"] || "" });
  response.json({ token: signAccessToken(user, sessionId), user: publicUser(user) });
});

app.get("/api/auth/me", requireAuth, (request, response) => response.json({ user: publicUser(request.auth.user) }));
app.post("/api/auth/logout", requireAuth, async (request, response) => {
  await authApi().revokeSession(request.auth.sessionId);
  response.json({ message: "Đã đăng xuất." });
});

app.get("/api/catalog", async (request, response) => {
  try {
    const items = await loadCatalog();
    response.json({ items: items.map(publicDocument) });
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
});

app.get("/api/contributors", async (request, response) => {
  try {
    const limit = Math.min(10, Math.max(1, Number(request.query.limit) || 5));
    response.json({ items: await documentApi().listTopContributors(limit) });
  } catch (error) {
    response.status(503).json({ error: error.message });
  }
});

app.get("/api/my/documents", requireAuth, async (request, response) => {
  response.json({ items: (await documentApi().listDocuments({ ownerId: request.auth.user.id, includeUnavailable: true })).map(publicDocument) });
});

app.get("/api/documents/:id", async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  response.json({ document: publicDocument(document) });
});

app.get("/api/documents/:id/content", async (request, response) => {
  const document = await ensureDocumentContent(await loadDocument(request.params.id));
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  const content = String(document.content || "").trim();
  if (!content) {
    return response.json({ documentId: document.id, title: document.title, contentAvailable: false, content: "" });
  }
  response.json({ documentId: document.id, title: document.title, contentAvailable: true, content });
});
app.get("/api/documents/:id/download", async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document?.fileUrl) return response.status(404).json({ error: "Tài liệu chưa có tệp." });
  await documentApi().incrementDownload(document.id).catch(() => {});
  response.redirect(document.fileUrl);
});

app.post("/api/documents", requireAuth, upload.single("file"), async (request, response) => {
  try {
    const title = String(request.body.title || "").trim();
    const summary = String(request.body.summary || "").trim();
    if (title.length < 3 || summary.length < 10) return response.status(400).json({ error: "Tiêu đề hoặc mô tả quá ngắn." });
    if (!request.file) return response.status(400).json({ error: "Bạn cần chọn một tệp hợp lệ, tối đa 20 MB." });
    const createdAt = now();
    const content = await readUploadedContent(request.file);
    const document = await documentApi().saveDocument({
      title, summary, category: request.body.category || "Tài liệu",
      tags: String(request.body.tags || "").split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 10),
      level: request.body.level || "all", source: "community", date: createdAt.slice(0, 10),
      available: true, status: "published", ownerId: request.auth.user.id,
      ownerName: request.auth.user.displayName, fileName: request.file.originalname,
      fileUrl: `/uploads/${request.file.filename}`, mimeType: request.file.mimetype,
      sizeBytes: request.file.size, downloadCount: 0, createdAt, updatedAt: createdAt,
      ...(content ? { content } : {}),
    });
    await documentApi().savePost({
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
  const updated = await documentApi().saveDocument({ id: document.id, available: Boolean(request.body.available), updatedAt: now() });
  response.json({ document: publicDocument({ ...document, ...updated }) });
});

app.post("/api/documents/:id/bookmark", requireAuth, async (request, response) => {
  const document = await loadDocument(request.params.id);
  if (!document) return response.status(404).json({ error: "Không tìm thấy tài liệu." });
  response.json(await documentApi().saveInteraction(request.auth.user.id, document.id, "bookmark", request.body.enabled !== false));
});

app.post("/api/search", async (request, response) => {
  const query = typeof request.body.query === "string" ? request.body.query.trim() : "";
  const contextDocumentId = typeof request.body.documentId === "string" ? request.body.documentId.trim() : "";
  if (query.length < 2 || query.length > 500) return response.status(400).json({ error: "Truy vấn phải có từ 2 đến 500 ký tự." });
  try {
    const catalog = await loadCatalog();
    if (contextDocumentId) {
      const index = catalog.findIndex((doc) => doc.id === contextDocumentId && doc.available);
      if (index < 0) return response.status(404).json({ error: "Không tìm thấy tài liệu đang mở." });
      const intentResult = assessQueryIntent(query, contextDocumentId);
      if (intentResult) return response.json({ ...intentResult, mode: "guard", dataSource: process.env.DATA_SOURCE || "local", contextDocumentId });
      catalog[index] = await ensureDocumentContent(catalog[index]);
    } else {
      const intentResult = assessQueryIntent(query, null);
      if (intentResult) return response.json({ ...intentResult, mode: "guard", dataSource: process.env.DATA_SOURCE || "local", contextDocumentId: null });
    }
    const mode = process.env.ENABLE_MOCK_AI === "true" ? "mock" : "gemini";
    const result = mode === "mock" ? mockSearch(query, catalog, contextDocumentId || null) : await geminiSearch(query, catalog, contextDocumentId || null);
    response.json({ ...result, mode, dataSource: process.env.DATA_SOURCE || "local", contextDocumentId: contextDocumentId || null });
  } catch (error) {
    const friendly = friendlyAiError(error);
    await writeTrace({ timestamp: now(), type: "ai_error", query, contextDocumentId: contextDocumentId || null, code: friendly.code, rawError: String(error?.message || error || "") }).catch(() => {});
    response.status(friendly.status).json({ error: friendly.message, code: friendly.code });
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


