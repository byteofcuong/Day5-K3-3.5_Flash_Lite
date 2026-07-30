import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

test("/api/search returns friendly message for AI quota errors", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousMock = process.env.ENABLE_MOCK_AI;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousStorePath = process.env.LOCAL_STORE_PATH;
  process.env.NODE_ENV = "test";
  process.env.DATA_SOURCE = "local";
  process.env.ENABLE_MOCK_AI = "false";
  process.env.GEMINI_API_KEY = "test-key";
  process.env.LOCAL_STORE_PATH = fileURLToPath(new URL("./tmp-quota-local-store.json", import.meta.url));
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: { message: "You exceeded your current quota, please check your plan and billing details. Please retry in 20.4" },
  }), { status: 429, headers: { "content-type": "application/json" } });
  const { app } = await import("../src/server.js?quota-test=1");
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await previousFetch(`${base}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Tóm tắt tài liệu này", documentId: "doc-context-keywords" }),
    });
    const body = await response.json();
    assert.equal(response.status, 429);
    assert.equal(body.code, "AI_RATE_LIMITED");
    assert.match(body.error, /AI Agent đang tạm hết lượt xử lý/);
    assert.doesNotMatch(body.error, /quota|billing|rate-limits|googleapis/i);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDataSource === undefined) delete process.env.DATA_SOURCE; else process.env.DATA_SOURCE = previousDataSource;
    if (previousMock === undefined) delete process.env.ENABLE_MOCK_AI; else process.env.ENABLE_MOCK_AI = previousMock;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousStorePath === undefined) delete process.env.LOCAL_STORE_PATH; else process.env.LOCAL_STORE_PATH = previousStorePath;
  }
});
test("local upload extracts PDF content for AI document context", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousMock = process.env.ENABLE_MOCK_AI;
  const previousSecret = process.env.JWT_SECRET;
  const previousStorePath = process.env.LOCAL_STORE_PATH;
  process.env.NODE_ENV = "test";
  process.env.DATA_SOURCE = "local";
  process.env.ENABLE_MOCK_AI = "true";
  process.env.JWT_SECRET = "01234567890123456789012345678901";
  process.env.LOCAL_STORE_PATH = fileURLToPath(new URL("./tmp-pdf-local-store.json", import.meta.url));
  const { app } = await import("../src/server.js?pdf-upload-test=1");
  const { readFile, unlink } = await import("node:fs/promises");
  const server = app.listen(0);
  let uploadedFileUrl = "";
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const email = `pdf-${Date.now()}@local.test`;
    const authResponse = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, displayName: "PDF Tester", password: "VShare@2026" }),
    });
    const auth = await authResponse.json();
    assert.equal(authResponse.status, 201, JSON.stringify(auth));
    const pdfData = await readFile(new URL("../../backend/docs/slide.pdf", import.meta.url));
    const form = new FormData();
    form.set("title", "PDF extraction test");
    form.set("summary", "Tài liệu PDF dùng để kiểm tra trích xuất text cho AI Agent.");
    form.set("level", "intermediate");
    form.set("tags", "pdf,agent");
    form.set("file", new Blob([pdfData], { type: "application/pdf" }), "slide.pdf");
    const uploadResponse = await fetch(`${base}/api/documents`, { method: "POST", headers: { authorization: `Bearer ${auth.token}` }, body: form });
    const uploadBody = await uploadResponse.json();
    assert.equal(uploadResponse.status, 201, JSON.stringify(uploadBody));
    uploadedFileUrl = uploadBody.document.fileUrl;
    const content = await fetch(`${base}/api/documents/${uploadBody.document.id}/content`).then((response) => response.json());
    assert.equal(content.contentAvailable, true);
    assert.match(content.content, /chatbot|agent/i);
    const ai = await fetch(`${base}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Tóm tắt tài liệu này", documentId: uploadBody.document.id }),
    }).then((response) => response.json());
    assert.equal(ai.status, "summary");
    assert.equal(ai.sources[0].documentId, uploadBody.document.id);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (uploadedFileUrl.startsWith("/uploads/")) {
      const fileName = decodeURIComponent(uploadedFileUrl.split("/").pop());
      await unlink(new URL(`../uploads/${fileName}`, import.meta.url)).catch(() => {});
    }
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDataSource === undefined) delete process.env.DATA_SOURCE; else process.env.DATA_SOURCE = previousDataSource;
    if (previousMock === undefined) delete process.env.ENABLE_MOCK_AI; else process.env.ENABLE_MOCK_AI = previousMock;
    await unlink(process.env.LOCAL_STORE_PATH).catch(() => {});
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousStorePath === undefined) delete process.env.LOCAL_STORE_PATH; else process.env.LOCAL_STORE_PATH = previousStorePath;
  }
});
test("/api/search blocks cross-document tool reads while in document context", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousMock = process.env.ENABLE_MOCK_AI;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousStorePath = process.env.LOCAL_STORE_PATH;
  const calls = [];
  process.env.NODE_ENV = "test";
  process.env.DATA_SOURCE = "local";
  process.env.ENABLE_MOCK_AI = "false";
  process.env.GEMINI_API_KEY = "test-key";
  process.env.LOCAL_STORE_PATH = fileURLToPath(new URL("./tmp-context-guard-local-store.json", import.meta.url));
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    if (calls.length === 1) {
      return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ functionCall: { name: "get_document_content", args: { document_id: "doc-api-latest", max_chars: 2000 } } }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify({ status: "answer", message: "Đã trả lời theo tài liệu đang mở.", results: [], sources: [{ documentId: "doc-api-latest" }] }) }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const { app } = await import("../src/server.js?context-guard-test=1");
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await previousFetch(`${base}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "Tóm tắt tài liệu này", documentId: "doc-context-keywords" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.sources[0].documentId, "doc-context-keywords");
    const toolResponse = calls[1].contents.at(-1).parts[0].functionResponse.response.result;
    assert.equal(toolResponse.error, "CONTEXT_DOCUMENT_ONLY");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDataSource === undefined) delete process.env.DATA_SOURCE; else process.env.DATA_SOURCE = previousDataSource;
    if (previousMock === undefined) delete process.env.ENABLE_MOCK_AI; else process.env.ENABLE_MOCK_AI = previousMock;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousStorePath === undefined) delete process.env.LOCAL_STORE_PATH; else process.env.LOCAL_STORE_PATH = previousStorePath;
  }
});
test("/api/search does not call Gemini/tools for random chatter", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDataSource = process.env.DATA_SOURCE;
  const previousMock = process.env.ENABLE_MOCK_AI;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = globalThis.fetch;
  const previousStorePath = process.env.LOCAL_STORE_PATH;
  let fetchCalled = false;
  process.env.NODE_ENV = "test";
  process.env.DATA_SOURCE = "local";
  process.env.ENABLE_MOCK_AI = "false";
  process.env.GEMINI_API_KEY = "test-key";
  process.env.LOCAL_STORE_PATH = fileURLToPath(new URL("./tmp-no-tool-local-store.json", import.meta.url));
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("Gemini should not be called for random chatter");
  };
  const { app } = await import("../src/server.js?no-tool-guard-test=1");
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await previousFetch(`${base}/api/search`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: "hello haha" }),
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(body.mode, "guard");
    assert.equal(body.status, "clarify");
    assert.equal(body.steps[0].label, "intent_check");
    assert.equal(fetchCalled, false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    globalThis.fetch = previousFetch;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
    if (previousDataSource === undefined) delete process.env.DATA_SOURCE; else process.env.DATA_SOURCE = previousDataSource;
    if (previousMock === undefined) delete process.env.ENABLE_MOCK_AI; else process.env.ENABLE_MOCK_AI = previousMock;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
    if (previousStorePath === undefined) delete process.env.LOCAL_STORE_PATH; else process.env.LOCAL_STORE_PATH = previousStorePath;
  }
});
