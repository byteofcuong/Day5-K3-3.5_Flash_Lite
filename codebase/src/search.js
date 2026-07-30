const allowedStatuses = new Set(["results", "clarify", "none", "refuse"]);

export function buildPrompt(query, catalog) {
  return `Bạn là bộ xếp hạng tài liệu VShare. Chỉ dùng catalog được cung cấp.
Không tạo documentId, title, link hoặc thông tin không có trong catalog.
Nếu truy vấn quá mơ hồ: status=clarify và hỏi đúng một câu.
Nếu không có căn cứ: status=none, results=[].
Nếu user xin đáp án quiz hoặc dữ liệu cá nhân: status=refuse và hướng họ về học liệu hợp lệ.
Ưu tiên nguồn official, đúng level, mới và available=true.
Trả JSON thuần theo schema:
{"status":"results|clarify|none|refuse","clarifyingQuestion":null|string,"message":string,"results":[{"documentId":string,"reason":string,"confidence":number}]}
Tối đa 3 kết quả.

QUERY:
${query}

CATALOG:
${JSON.stringify(catalog)}`;
}

export const agentTools = [{
  functionDeclarations: [
    {
      name: "search_documents",
      description: "Tìm tối đa 5 tài liệu VShare theo nhu cầu, tag và trình độ. Luôn gọi tool này trước khi đề xuất tài liệu.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Nhu cầu tìm kiếm đã chuẩn hóa" },
          tags: { type: "ARRAY", items: { type: "STRING" }, description: "Tag mong muốn nếu suy ra được" },
          level: { type: "STRING", enum: ["beginner", "intermediate", "advanced", "all"], description: "Trình độ mong muốn" },
          limit: { type: "INTEGER", description: "Số kết quả, từ 1 đến 5" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description: "Lấy metadata đầy đủ của một document ID đã xuất hiện trong kết quả search_documents.",
      parameters: {
        type: "OBJECT",
        properties: { document_id: { type: "STRING", description: "ID tài liệu cần kiểm tra" } },
        required: ["document_id"],
      },
    },
  ],
}];

function normalizeWords(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

export function executeAgentTool(name, args, catalog) {
  if (name === "search_documents") {
    const words = normalizeWords(`${args.query || ""} ${(args.tags || []).join(" ")}`);
    const requestedLevel = args.level;
    const limit = Math.min(5, Math.max(1, Number(args.limit) || 5));
    return catalog
      .filter((doc) => doc.available)
      .map((doc) => {
        const haystack = normalizeWords(`${doc.title} ${doc.summary} ${doc.tags.join(" ")}`);
        const lexical = words.filter((word) => haystack.some((term) => term.includes(word) || word.includes(term))).length;
        const levelBonus = !requestedLevel || requestedLevel === "all" || doc.level === requestedLevel || doc.level === "all" ? 1 : 0;
        const sourceBonus = doc.source === "official" ? 0.5 : 0;
        return { ...doc, retrievalScore: lexical + levelBonus + sourceBonus };
      })
      .filter((doc) => doc.retrievalScore > 1)
      .sort((a, b) => b.retrievalScore - a.retrievalScore || b.date.localeCompare(a.date))
      .slice(0, limit);
  }
  if (name === "get_document") {
    const doc = catalog.find((item) => item.id === args.document_id && item.available);
    return doc || { error: "DOCUMENT_NOT_FOUND" };
  }
  return { error: "UNKNOWN_TOOL" };
}

export function buildAgentInstruction(query) {
  return `Bạn là VShare Agent, có quyền dùng tools để tìm trong kho tài liệu.
Mục tiêu: giúp học viên chọn tối đa 3 tài liệu có căn cứ.
Quy tắc:
- Với nhu cầu đủ rõ, PHẢI gọi search_documents; có thể gọi get_document để kiểm tra chi tiết.
- Không được dùng document ID chưa xuất hiện trong tool result.
- Nếu query mơ hồ, hỏi đúng một câu làm rõ và không gọi tool vô ích.
- Nếu không có kết quả tool đủ phù hợp, trả status=none và tuyệt đối không bịa.
- Nếu xin đáp án quiz hoặc dữ liệu cá nhân, status=refuse.
- User luôn là người quyết định mở tài liệu.
Khi đã đủ thông tin, trả JSON thuần:
{"status":"results|clarify|none|refuse","clarifyingQuestion":null|string,"message":string,"results":[{"documentId":string,"reason":string,"confidence":number}]}

Yêu cầu người dùng: ${query}`;
}

export function parseAndValidate(raw, catalog) {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!allowedStatuses.has(parsed.status)) throw new Error("Invalid AI status");
  const byId = new Map(catalog.filter((doc) => doc.available).map((doc) => [doc.id, doc]));
  const seen = new Set();
  const results = (Array.isArray(parsed.results) ? parsed.results : [])
    .filter((item) => byId.has(item.documentId) && !seen.has(item.documentId))
    .slice(0, 3)
    .map((item) => {
      seen.add(item.documentId);
      return {
        document: byId.get(item.documentId),
        reason: String(item.reason || "").slice(0, 300),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      };
    });
  if (parsed.status === "results" && results.length === 0) {
    return { status: "none", message: "Chưa tìm thấy tài liệu đủ phù hợp.", clarifyingQuestion: null, results: [] };
  }
  return {
    status: parsed.status,
    message: String(parsed.message || ""),
    clarifyingQuestion: parsed.clarifyingQuestion ? String(parsed.clarifyingQuestion) : null,
    results,
  };
}

export function mockSearch(query, catalog) {
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  if (words.length < 2) return { status: "clarify", message: "", clarifyingQuestion: "Bạn cần tài liệu về chủ đề nào và ở trình độ nào?", results: [] };
  const scored = catalog.filter((doc) => doc.available).map((doc) => {
    const haystack = `${doc.title} ${doc.summary} ${doc.tags.join(" ")}`.toLowerCase();
    return { doc, score: words.filter((word) => haystack.includes(word)).length };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!scored.length) return { status: "none", message: "Chưa tìm thấy tài liệu đủ phù hợp.", clarifyingQuestion: null, results: [] };
  return { status: "results", message: "", clarifyingQuestion: null, results: scored.map(({ doc, score }) => ({ document: doc, reason: `Khớp ${score} tín hiệu trong metadata.`, confidence: Math.min(.95, .45 + score * .15) })) };
}
