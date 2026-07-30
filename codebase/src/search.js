import { buildAgentInstruction } from "./ai/prompts.js";
import { agentTools, executeAgentTool } from "./ai/agent.tools.js";
import { handleRagChat, summarizeDocumentWithRag, handleDocumentScopedChat, generateDocumentFlashcards } from "./ai/rag.service.js";

export { buildAgentInstruction, agentTools, executeAgentTool };

export function parseAndValidate(rawText, catalog) {
  try {
    const cleaned = String(rawText || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch {
    return { status: "none", message: "Lỗi định dạng JSON.", results: [] };
  }
}

export async function summarizeDocument(docIdOrObj, catalog) {
  const doc = typeof docIdOrObj === "object" ? docIdOrObj : catalog.find(d => d.id === docIdOrObj);
  if (!doc) throw new Error("Không tìm thấy tài liệu cần tóm tắt.");
  return summarizeDocumentWithRag(doc);
}

export async function chatWithAi(messages, documentId, catalog) {
  return handleRagChat(messages, catalog);
}

export async function chatWithDocument(messages, doc) {
  return handleDocumentScopedChat(messages, doc);
}

export async function generateFlashcards(doc) {
  return generateDocumentFlashcards(doc);
}

export function mockSearch(query, catalog) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = catalog
    .filter((doc) => doc.available)
    .map((doc) => {
      const haystack = `${doc.title} ${doc.summary} ${(doc.tags || []).join(" ")}`.toLowerCase();
      const score = words.filter((w) => haystack.includes(w)).length;
      return { doc, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => ({
      documentId: item.doc.id,
      reason: `Khớp từ khóa phù hợp với "${query}".`,
      confidence: Math.min(0.95, 0.6 + item.score * 0.1),
    }));

  return {
    status: results.length ? "results" : "none",
    clarifyingQuestion: null,
    message: results.length ? `Tìm thấy ${results.length} tài liệu.` : "Không có kết quả.",
    results,
  };
}
