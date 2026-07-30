/** Tools exposed to the AI agent. Keep these schemas narrow; backend validation is still authoritative. */
export const agentTools = [{
  functionDeclarations: [
    {
      name: "search_documents",
      description: "Find up to 5 available VShare documents by learning need, tags, and level. Use before recommending documents.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: { type: "STRING", description: "Normalized search need from the user" },
          tags: { type: "ARRAY", items: { type: "STRING" }, description: "Desired tags, if inferable" },
          level: { type: "STRING", enum: ["beginner", "intermediate", "advanced", "all"], description: "Desired learner level" },
          limit: { type: "INTEGER", description: "Result count from 1 to 5" },
        },
        required: ["query"],
      },
    },
    {
      name: "get_document",
      description: "Get safe metadata for an available document ID that was already found or explicitly named by the user.",
      parameters: {
        type: "OBJECT",
        properties: { document_id: { type: "STRING", description: "Document ID to inspect" } },
        required: ["document_id"],
      },
    },
    {
      name: "get_document_content",
      description: "Get controlled text content for an available document ID. Use only after a document ID is known.",
      parameters: {
        type: "OBJECT",
        properties: {
          document_id: { type: "STRING", description: "Document ID to read" },
          max_chars: { type: "INTEGER", description: "Maximum characters to return, default 8000" },
        },
        required: ["document_id"],
      },
    },
  ],
}];

function normalizeWords(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

function publicDocument(doc) {
  const { content, ...safe } = doc;
  return { ...safe, hasContent: Boolean(String(content || "").trim()) };
}

export function executeAgentTool(name, args = {}, catalog = []) {
  if (name === "search_documents") {
    const queryTerms = normalizeWords(`${args.query || ""} ${(args.tags || []).join(" ")}`);
    const requestedLevel = args.level;
    const limit = Math.min(5, Math.max(1, Number(args.limit) || 3));

    if (!queryTerms.length) return [];

    const scored = catalog
      .filter((doc) => doc.available)
      .map((doc) => {
        const haystack = normalizeWords(`${doc.title} ${doc.summary} ${(doc.tags || []).join(" ")} ${doc.content || ""}`);
        const lexical = queryTerms.filter((word) => haystack.some((term) => term === word || (word.length > 3 && term.length > 3 && (term.includes(word) || word.includes(term))))).length;
        const levelBonus = !requestedLevel || requestedLevel === "all" || doc.level === requestedLevel || doc.level === "all" ? 1 : 0;
        const sourceBonus = doc.source === "official" ? 0.5 : 0;
        return { doc, score: lexical + levelBonus + sourceBonus, lexical };
      })
      .filter((item) => item.lexical > 0)
      .sort((a, b) => b.score - a.score || String(b.doc.date || "").localeCompare(String(a.doc.date || "")))
      .slice(0, limit);

    return scored.map((item) => publicDocument(item.doc));
  }

  if (name === "get_document") {
    const doc = catalog.find((item) => item.id === args.document_id && item.available);
    return doc ? publicDocument(doc) : { error: "DOCUMENT_NOT_FOUND" };
  }

  if (name === "get_document_content") {
    const doc = catalog.find((item) => item.id === args.document_id && item.available);
    if (!doc) return { error: "DOCUMENT_NOT_FOUND" };
    const content = String(doc.content || "").trim();
    if (!content) return { error: "CONTENT_NOT_AVAILABLE", documentId: doc.id, title: doc.title };
    const maxChars = Math.min(12000, Math.max(1000, Number(args.max_chars) || 8000));
    return {
      documentId: doc.id,
      title: doc.title,
      content: content.slice(0, maxChars),
      truncated: content.length > maxChars,
      source: "catalog",
    };
  }

  return { error: "UNKNOWN_TOOL" };
}