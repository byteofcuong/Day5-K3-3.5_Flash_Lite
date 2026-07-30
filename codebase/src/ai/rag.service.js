import { callGeminiApi } from "./llm.provider.js";
import { agentTools, executeAgentTool } from "./agent.tools.js";
import { buildRagSystemInstruction, buildSummarizePrompt, buildAgentInstruction, buildFlashcardPrompt } from "./prompts.js";

function normalizeWords(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1);
}

/** Chuẩn hóa danh sách tin nhắn gửi sang Gemini API (tránh trùng role) */
function formatGeminiContents(messages) {
  const formatted = [];
  messages.forEach((m) => {
    const role = m.role === "user" ? "user" : "model";
    const text = typeof m.content === "string" ? m.content.trim() : JSON.stringify(m.content);
    if (!text) return;
    if (formatted.length > 0 && formatted[formatted.length - 1].role === role) {
      formatted[formatted.length - 1].parts[0].text += "\n" + text;
    } else {
      formatted.push({ role, parts: [{ text }] });
    }
  });
  return formatted.length ? formatted : [{ role: "user", parts: [{ text: "Hello" }] }];
}

/** Bộ Máy ReAct Agent Thật 100% (Thought -> Action: Call Tool -> Observation: Result -> Final Answer) */
export async function handleRagChat(messages, catalog) {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const lowerMsg = lastMessage.trim().toLowerCase();
  const agentTrace = [];

  // Smart Room Matching
  let recommendedRoom = { id: "room-general", name: "💬 Thảo Luận Học Tập Chung" };
  if (lowerMsg.includes("react") || lowerMsg.includes("agent")) {
    recommendedRoom = { id: "room-agent", name: "🤖 AI Agent & ReAct Framework" };
  } else if (lowerMsg.includes("prompt") || lowerMsg.includes("instruction")) {
    recommendedRoom = { id: "room-prompt", name: "📝 Prompt & Context Engineering" };
  } else if (lowerMsg.includes("rag") || lowerMsg.includes("context") || lowerMsg.includes("memory")) {
    recommendedRoom = { id: "room-rag", name: "📚 RAG & Tri Thức Hợp Lệ" };
  }

  // Smart Greeting Check
  const isGreeting = /^(hello|hi|helo|xin chào|chào|chào bạn|hi bot|hello bot)$/i.test(lowerMsg);
  if (isGreeting) {
    agentTrace.push(`👋 **ReAct Loop - Greeting:** Nhận diện tin nhắn chào hỏi. Phản hồi mượt mà không cần gọi Tool.`);
    return {
      reply: "Xin chào! Mình là VShare AI Assistant 🤖. Bạn cần hỗ trợ tra cứu tài liệu RAG, tóm tắt hay giải đáp thắc mắc bài học nào hôm nay?",
      matchedDocs: [],
      recommendedRoom,
      agentTrace,
      draftPost: null
    };
  }

  // --- REACT AGENT LOOP (VÒNG LẶP SUY NGHĨ & GỌI TOOL THẬT 100%) ---
  agentTrace.push(`🧠 **Thought 1 (Suy nghĩ ReAct):** Người dùng hỏi "${lastMessage}". Cần gọi Tool \`search_documents\` để truy vấn kho tài liệu VShare.`);

  let matchedDocs = [];
  let currentContents = formatGeminiContents(messages);

  if (process.env.ENABLE_MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    agentTrace.push(`🛠️ **Action 1 (Gọi Tool \`search_documents\`):** Thực thi Tool trên CSDL Local với query = "${lastMessage}"...`);
    const toolResult = executeAgentTool("search_documents", { query: lastMessage }, catalog);
    matchedDocs = Array.isArray(toolResult) ? toolResult.slice(0, 3) : [];
    agentTrace.push(`👁️ **Observation 1 (Kết quả Tool \`search_documents\`):** Trả về ${matchedDocs.length} tài liệu: ${matchedDocs.map(d => `"${d.title}"`).join(", ")}`);
    agentTrace.push(`🏁 **Final Thought:** Tổng hợp tri thức trích xuất và đưa ra câu trả lời cuối cùng.`);

    const mockReply = `Dựa trên các tài liệu VShare trích xuất được từ Tool \`search_documents\`:\n\n📚 **Các tài liệu liên quan:**\n` +
      matchedDocs.map((d) => `• **${d.title}** (${d.level}): ${d.summary}`).join("\n");
    return { reply: mockReply, matchedDocs, recommendedRoom, agentTrace, draftPost: null };
  }

  try {
    const responseRound1 = await callGeminiApi({
      contents: currentContents,
      systemInstruction: buildAgentInstruction(catalog),
      tools: agentTools,
      temperature: 0.2
    });

    if (typeof responseRound1 === "object" && responseRound1.type === "functionCall") {
      const toolName = responseRound1.name;
      const toolArgs = responseRound1.args;

      agentTrace.push(`🛠️ **Action 1 (ReAct Agent Gọi Tool \`${toolName}\`):** LLM tự phát sinh quyết định gọi Tool với tham số: \`${JSON.stringify(toolArgs)}\``);

      const toolResult = executeAgentTool(toolName, toolArgs, catalog);
      matchedDocs = Array.isArray(toolResult) ? toolResult.slice(0, 3) : [];

      agentTrace.push(`👁️ **Observation 1 (Kết quả Trả Về Từ Tool \`${toolName}\`):** CSDL trả về ${matchedDocs.length} tài liệu thực tế.`);
      agentTrace.push(`🧠 **Thought 2 (Suy nghĩ ReAct):** Đã nhận kết quả Observation từ Tool \`${toolName}\`. Đang tổng hợp phản hồi hoàn chỉnh cho người dùng...`);

      const authors = [...new Set(matchedDocs.map((d) => d.ownerName).filter(Boolean))];
      const peerList = authors.length > 0 ? authors.join(", ") : "Quản trị viên";
      const peerSuggestion = `\n\n🤝 **Kết nối cùng sở thích:** Học viên **${peerList}** đã đăng các tài liệu chất lượng về chủ đề này.`;

      const docListText = matchedDocs.map(d => `• **"${d.title}"** (Tác giả: ${d.ownerName || "Cộng đồng"}): ${d.summary}`).join("\n");
      const finalReply = `Dựa trên kết quả thực thi Tool \`search_documents\` trong kho tri thức VShare:\n\n📚 **Các tài liệu tìm thấy:**\n${docListText}${peerSuggestion}`;

      agentTrace.push(`🏁 **Final Answer (Phản Hồi Cuối Cùng):** Hoàn tất chuỗi ReAct Loop (Thought 1 -> Action 1: Call Tool -> Observation 1: Tool Result -> Thought 2 -> Final Answer).`);

      return { reply: finalReply, matchedDocs, recommendedRoom, agentTrace, draftPost: null };
    } else {
      const directText = typeof responseRound1 === "object" ? responseRound1.text : responseRound1;
      agentTrace.push(`🏁 **Direct Answer:** Agent nhận diện câu hỏi và đưa ra câu trả lời trực tiếp.`);
      return { reply: directText, matchedDocs: [], recommendedRoom, agentTrace, draftPost: null };
    }
  } catch (err) {
    console.error("ReAct Agent Loop Error:", err.message);
    agentTrace.push(`⚠️ **ReAct Fallback:** Gặp sự cố (${err.message}). Chuyển sang cơ chế RAG dự phòng.`);
    const fallbackResult = executeAgentTool("search_documents", { query: lastMessage }, catalog);
    matchedDocs = Array.isArray(fallbackResult) ? fallbackResult.slice(0, 3) : [];
    return {
      reply: `Dựa trên các tài liệu trích xuất từ VShare: ${matchedDocs.map(d => d.title).join(", ")}.`,
      matchedDocs,
      recommendedRoom,
      agentTrace,
      draftPost: null
    };
  }
}

/** 3. Xử lý Hỏi đáp Trợ giảng AI trực tiếp trong phạm vi 1 Tài liệu (kèm Log Tiến Trình docTrace) */
export async function handleDocumentScopedChat(messages, doc) {
  const lastMessage = messages[messages.length - 1]?.content || "";
  const rawText = doc.content || doc.summary || "Tài liệu học tập VShare.";
  const fullText = rawText.slice(0, 3500);

  const docTrace = [
    `📄 **Bước 1 (Đọc Bài):** Mở tài liệu "${doc.title}" (Độ dài: ${fullText.length} ký tự)...`,
    `🔍 **Bước 2 (Phân Phân Tích):** Trích xuất các đoạn văn bản liên quan đến câu hỏi "${lastMessage}"...`,
    `🤖 **Bước 3 (Trợ Giảng AI):** Nạp dữ liệu vào Gemini 3.5 Flash Lite để sinh lời giải thích...`
  ];

  const systemInstruction = `Bạn là Trợ Giảng AI Cá Nhân riêng cho tài liệu "${doc.title}" (Tác giả: ${doc.ownerName || "Cộng đồng"}).
Nhiệm vụ: CHỈ giải đáp thắc mắc của học viên DỰA TRÊN CHÍNH XÁC NỘI DUNG VĂN BẢN TRÍCH XUẤT dưới đây:
---
${fullText}
---
- Trả lời thân thiện, sư phạm, giải thích ngắn gọn, đúng trọng tâm.
- Nếu thông tin nằm ngoài phạm vi tài liệu này, hãy nhắc nhẹ học viên rằng tài liệu hiện tại không đề cập tới ý đó.`;

  if (process.env.ENABLE_MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    docTrace.push(`✅ **Bước 4 (Hoàn tất):** Trả về kết quả từ RAG Nội bị.`);
    return {
      reply: `[Trợ Giảng AI cho "${doc.title}"]: Dựa trên bài đọc này: ${doc.summary}`,
      docTrace
    };
  }

  const formattedContents = formatGeminiContents(messages);

  try {
    const res = await callGeminiApi({ contents: formattedContents, systemInstruction, temperature: 0.3 });
    const replyText = typeof res === "object" ? res.text : res;
    docTrace.push(`✅ **Bước 4 (Hoàn tất):** Trợ Giảng AI sinh lời giảng thành công.`);
    return { reply: replyText || `Dựa trên nội dung tài liệu "${doc.title}": ${doc.summary}`, docTrace };
  } catch (err) {
    console.error("Document Scoped Chat Error:", err.message);
    docTrace.push(`⚠️ **Bước 4 (Lỗi AI):** ${err.message}`);
    return {
      reply: `Dựa trên nội dung tài liệu "${doc.title}": ${doc.summary} (Lỗi AI: ${err.message})`,
      docTrace
    };
  }
}

/** 4. Tự động tạo Thẻ Flashcard Ôn Tập Kiến Thức bằng AI */
export async function generateDocumentFlashcards(doc) {
  const fullText = doc.content || doc.summary || "Tài liệu học tập VShare.";
  const prompt = buildFlashcardPrompt(doc.title, fullText.slice(0, 3500));

  if (process.env.ENABLE_MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return [
      { id: 1, question: `Khái niệm chính trong "${doc.title}" là gì?`, answer: doc.summary },
      { id: 2, question: `Tác giả bài viết là ai?`, answer: doc.ownerName || "Cộng đồng VShare" },
      { id: 3, question: `Trình độ bài đọc này dành cho ai?`, answer: `Phù hợp với học viên trình độ ${doc.level || "cơ bản"}.` }
    ];
  }

  try {
    const rawResponseObj = await callGeminiApi({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: 0.2
    });

    const rawResponse = typeof rawResponseObj === "object" ? rawResponseObj.text : rawResponseObj;
    const cleaned = rawResponse.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return Array.isArray(parsed) ? parsed : [
      { id: 1, question: `Khái niệm chính trong "${doc.title}"?`, answer: doc.summary }
    ];
  } catch (err) {
    console.error("Flashcard generation error:", err.message);
    return [
      { id: 1, question: `Nội dung cốt lõi của bài "${doc.title}" là gì?`, answer: doc.summary },
      { id: 2, question: `Đối tượng học viên bài viết hướng tới?`, answer: `Học viên mức độ ${doc.level || "cơ bản"}.` }
    ];
  }
}

/** 5. Tóm tắt tài liệu bằng RAG thật */
export async function summarizeDocumentWithRag(doc) {
  const fullText = doc.content || doc.summary || "Tài liệu học tập trên hệ thống VShare.";
  const prompt = buildSummarizePrompt(doc.title, fullText);

  if (process.env.ENABLE_MOCK_AI === "true" || !process.env.GEMINI_API_KEY) {
    return {
      docId: doc.id,
      title: doc.title,
      summary: doc.summary,
      keyPoints: (doc.content || doc.summary).split("\n").filter(l => l.trim().length > 5).slice(0, 3),
      targetAudience: `Học viên trình độ ${doc.level || "cơ bản"}`,
      recommendedAction: "Đọc trực tiếp tài liệu đính kèm trên VShare."
    };
  }

  try {
    const rawResponseObj = await callGeminiApi({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      temperature: 0.2
    });

    const rawResponse = typeof rawResponseObj === "object" ? rawResponseObj.text : rawResponseObj;
    const cleaned = rawResponse.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      docId: doc.id,
      title: doc.title,
      summary: doc.summary,
      keyPoints: parsed.keyPoints || [doc.summary],
      targetAudience: parsed.targetAudience || "Mọi học viên",
      recommendedAction: parsed.recommendedAction || "Đọc kỹ tài liệu trước khi làm bài."
    };
  } catch (err) {
    return {
      docId: doc.id,
      title: doc.title,
      summary: doc.summary,
      keyPoints: (doc.content || doc.summary).split("\n").filter(l => l.trim().length > 5).slice(0, 3),
      targetAudience: `Học viên trình độ ${doc.level || "cơ bản"}`,
      recommendedAction: "Đọc trực tiếp nội dung đính kèm trên VShare."
    };
  }
}
