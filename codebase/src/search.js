import { buildAgentInstruction } from "./ai/prompts.js";
import { agentTools, executeAgentTool } from "./ai/agent.tools.js";
import { handleRagChat, summarizeDocumentWithRag, handleDocumentScopedChat, generateDocumentFlashcards } from "./ai/rag.service.js";

export { buildAgentInstruction, agentTools, executeAgentTool };

const allowedStatuses = new Set(["results", "clarify", "none", "refuse", "summary", "answer"]);
const stopWords = new Set(["toi", "can", "tim", "tai", "lieu", "ve", "cho", "minh", "hoc", "dang", "va", "moi", "nay", "kia", "gi", "nao", "oi", "ban"]);
const specificTerms = new Set(["react", "gemini", "firebase", "context", "prompt", "llm", "rag", "agent", "chatbot", "api", "tool", "workflow"]);

function normalizeWords(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

function publicDocument(doc) {
  const { content, ...safe } = doc;
  return { ...safe, hasContent: Boolean(String(content || "").trim()) };
}

function emptyResult(message = "Chưa tìm thấy tài liệu đủ phù hợp.") {
  return { status: "none", message, clarifyingQuestion: null, results: [], sources: [] };
}

export function parseAndValidate(rawText, catalog) {
  try {
    const cleaned = String(rawText || "").replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!allowedStatuses.has(parsed.status)) return emptyResult("Trạng thái AI không hợp lệ.");

    const byId = new Map(catalog.filter((doc) => doc.available).map((doc) => [doc.id, doc]));
    const seen = new Set();
    const results = (Array.isArray(parsed.results) ? parsed.results : [])
      .filter((item) => byId.has(item.documentId) && !seen.has(item.documentId))
      .slice(0, 3)
      .map((item) => {
        seen.add(item.documentId);
        return {
          documentId: item.documentId,
          document: publicDocument(byId.get(item.documentId)),
          reason: String(item.reason || "").slice(0, 300),
          confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
        };
      });

    const sourceSeen = new Set();
    const sources = (Array.isArray(parsed.sources) ? parsed.sources : [])
      .filter((item) => byId.has(item.documentId) && !sourceSeen.has(item.documentId))
      .slice(0, 5)
      .map((item) => {
        sourceSeen.add(item.documentId);
        const doc = byId.get(item.documentId);
        return { documentId: doc.id, title: doc.title };
      });

    if (parsed.status === "results" && results.length === 0) return emptyResult();
    if (["summary", "answer"].includes(parsed.status) && !sources.length && results.length) {
      sources.push(...results.map((item) => ({ documentId: item.document.id, title: item.document.title })));
    }

    return {
      status: parsed.status,
      message: String(parsed.message || ""),
      clarifyingQuestion: parsed.clarifyingQuestion ? String(parsed.clarifyingQuestion) : null,
      results,
      sources,
    };
  } catch {
    return { status: "none", message: "Lỗi định dạng JSON.", clarifyingQuestion: null, results: [], sources: [] };
  }
}

export async function summarizeDocument(docIdOrObj, catalog) {
  const doc = typeof docIdOrObj === "object" ? docIdOrObj : catalog.find((d) => d.id === docIdOrObj && d.available);
  if (!doc) throw new Error("Không tìm thấy tài liệu cần tóm tắt.");
  return summarizeDocumentWithRag(doc);
}

export async function chatWithAi(messages, documentId, catalog) {
  return handleRagChat(messages, catalog, documentId);
}

export async function chatWithDocument(messages, doc) {
  return handleDocumentScopedChat(messages, doc);
}

export async function generateFlashcards(doc) {
  return generateDocumentFlashcards(doc);
}

function assessQuery(query) {
  const words = normalizeWords(query).filter((word) => !stopWords.has(word));
  const specificWords = words.filter((word) => specificTerms.has(word));
  const lower = String(query || "").trim().toLowerCase();
  if (/(ignore|bỏ qua|bo qua).*(instruction|rules|luật|luat)|reveal.*(system prompt|prompt|api key|token)|lộ.*(prompt|api key|token)|show.*(system prompt|api key|token)/i.test(lower)) {
    return { status: "refuse", message: "Mình không thể tiết lộ system prompt, API key, token hoặc bỏ qua các quy tắc an toàn.", clarifyingQuestion: null, results: [], sources: [] };
  }
  const isGreetingOnly = /^(hi|hello|hey|alo|chào|chao|xin chào|xin chao|ok|oke|ừ|uh|ờ|test|abc|asdf|haha|hehe)[\s!.?]*$/i.test(lower);
  const gibberish = words.length > 0 && words.every((word) => /(.)\1{2,}/.test(word) || word.length < 3);

  if (isGreetingOnly || gibberish || words.length === 0) {
    return { status: "clarify", message: "", clarifyingQuestion: "Bạn muốn tìm tài liệu về chủ đề nào và ở trình độ nào?", results: [], sources: [] };
  }

  if (words.length < 2 && !specificWords.length) {
    return { status: "clarify", message: "", clarifyingQuestion: "Bạn muốn tìm tài liệu về chủ đề nào và ở trình độ nào?", results: [], sources: [] };
  }

  if (words.length === 1 && specificWords[0] === "ai") {
    return { status: "clarify", message: "", clarifyingQuestion: "Bạn muốn tìm tài liệu AI về mảng nào: LLM, RAG, Agent hay Prompt Engineering?", results: [], sources: [] };
  }

  return null;
}

export function mockSearch(query, catalog) {
  const intent = assessQuery(query);
  if (intent) return intent;

  const words = normalizeWords(query).filter((word) => !stopWords.has(word));
  const requestedLevel = /m[oơ]i h[oọ]c|beginner|c[oơ] b[aả]n|nh[aậ]p m[oô]n/i.test(query) ? "beginner" : null;
  const specificWords = words.filter((word) => specificTerms.has(word));
  const scoringWords = specificWords.length ? specificWords : words;

  const scored = catalog
    .filter((doc) => doc.available)
    .map((doc) => {
      const haystackWords = normalizeWords(`${doc.title} ${doc.summary} ${(doc.tags || []).join(" ")}`);
      const lexical = scoringWords.filter((word) => haystackWords.some((term) => term === word || (word.length > 3 && term.length > 3 && (term.includes(word) || word.includes(term))))).length;
      const levelBonus = requestedLevel && (doc.level === requestedLevel || doc.level === "all") ? 1 : 0;
      const sourceBonus = doc.source === "official" ? 0.5 : 0;
      return { doc, lexical, score: lexical + levelBonus + sourceBonus };
    })
    .filter((item) => item.lexical > 0)
    .sort((a, b) => b.score - a.score || String(b.doc.date || "").localeCompare(String(a.doc.date || "")))
    .slice(0, 3);

  if (!scored.length) return emptyResult();

  return {
    status: "results",
    clarifyingQuestion: null,
    message: `Tìm thấy ${scored.length} tài liệu.`,
    sources: [],
    results: scored.map(({ doc, score }) => ({
      documentId: doc.id,
      document: publicDocument(doc),
      reason: requestedLevel ? `Khớp ${score} tín hiệu, ưu tiên tài liệu cho người mới học.` : `Khớp ${score} tín hiệu trong metadata.`,
      confidence: Math.min(0.95, 0.45 + score * 0.15),
    })),
  };
}