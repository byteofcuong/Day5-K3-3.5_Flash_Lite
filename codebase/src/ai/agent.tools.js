/** Danh sách các Tools khai báo cho AI Agent */
export const agentTools = [{
  functionDeclarations: [
    {
      name: "search_documents",
      description: "Tìm tối đa 5 tài liệu VShare theo nhu cầu, tag và trình độ. Luôn gọi tool này trước khi đề xuất tài liệu.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Nhu cầu tìm kiếm đã chuẩn hóa" },
          tags: { type: "ARRAY", items: { type: "STRING" }, description: "Tag mong muốn" },
          level: { type: "STRING", enum: ["beginner", "intermediate", "advanced", "all"] },
          limit: { type: "INTEGER" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description: "Lấy metadata đầy đủ của một document ID đã xuất hiện.",
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

/** Thực thi Tool tìm kiếm tài liệu chuẩn điểm Relevance Scoring khi Agent gọi */
export function executeAgentTool(name, args, catalog) {
  if (name === "search_documents") {
    const searchTerms = normalizeWords(args.query);
    const lowerQuery = String(args.query || "").toLowerCase();

    if (lowerQuery.includes("agent") || lowerQuery.includes("react")) searchTerms.push("agent", "react", "tool");
    if (lowerQuery.includes("prompt")) searchTerms.push("prompt", "context");
    if (lowerQuery.includes("ai") || lowerQuery.includes("llm")) searchTerms.push("ai", "llm", "foundation", "slide", "chatbot");

    const scored = catalog
      .filter((doc) => doc.available)
      .map((doc) => {
        const haystack = normalizeWords(`${doc.title} ${doc.summary} ${doc.content || ""} ${(doc.tags || []).join(" ")}`);
        const score = searchTerms.filter((w) => haystack.some((term) => term.includes(w) || w.includes(term))).length;
        return { doc, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const limit = Number(args.limit) || 3;
    const results = scored.slice(0, limit).map((item) => item.doc);

    if (results.length > 0) {
      return results;
    }

    // Nếu không khớp từ khóa cụ thể -> lọc bỏ các tài liệu rác tên 'test'
    return catalog
      .filter((doc) => doc.available && !doc.title.toLowerCase().includes("test"))
      .slice(0, limit);
  }

  if (name === "get_document") {
    return catalog.find((doc) => doc.id === args.document_id) || null;
  }
  return { error: "Tool không tồn tại" };
}
