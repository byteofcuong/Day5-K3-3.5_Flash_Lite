import test from "node:test";
import assert from "node:assert/strict";
import { callGeminiApi } from "../src/ai/llm.provider.js";

test("preserves Gemini thought signatures on function-call parts", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";

  const signedParts = [
    { text: "Tìm trong kho tài liệu." },
    {
      functionCall: { name: "search_documents", args: { query: "ReAct" } },
      thoughtSignature: "encrypted-signature",
    },
  ];

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      candidates: [{ content: { role: "model", parts: signedParts } }],
    }),
  });

  try {
    const turn = await callGeminiApi({
      contents: [{ role: "user", parts: [{ text: "Tìm ReAct" }] }],
      tools: [{ functionDeclarations: [] }],
    });

    assert.equal(turn.type, "functionCall");
    assert.equal(turn.name, "search_documents");
    assert.deepEqual(turn.modelParts, signedParts);
    assert.equal(turn.modelParts[1].thoughtSignature, "encrypted-signature");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
});
