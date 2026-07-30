import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { paths } from "../config/env.js";
import { nowIso } from "../lib/ids.js";
import { extractPdfText } from "../lib/pdf-text.js";

/**
 * Builds the initial database the first time db.json is missing.
 *
 * Documents come from two sources:
 *  - data/catalog.json  — text-only entries the AI agent reasons over;
 *  - PDF_DOCUMENTS      — the real slide decks in backend/docs, served by the
 *                         /library static mount so the reader can embed them.
 */

const DEMO_PASSWORD = "VShare@2026";

const DEMO_USERS = [
  { id: "user_admin", email: "admin@vshare.local", displayName: "Quản trị VShare", role: "admin", bio: "Quản trị viên kho học liệu." },
  { id: "user_viet", email: "viet@vshare.local", displayName: "Việt Nguyễn", role: "member", bio: "Quan tâm đến AI Agent và xây dựng sản phẩm." },
  { id: "user_minh", email: "minh@vshare.local", displayName: "Minh Phạm", role: "member", bio: "Chia sẻ tài liệu về ReAct và Agentic AI." },
  { id: "user_lan", email: "lan@vshare.local", displayName: "Lan Trần", role: "member", bio: "Học viên AI & LLM Foundation." },
  { id: "user_nam", email: "nam@vshare.local", displayName: "Nam Hoàng", role: "member", bio: "Yêu thích cộng đồng học tập mở." },
];

/**
 * Slide decks that exist as real files on disk. `fileUrl` points at the
 * /library static mount (backend/docs), so the reader embeds the actual PDF
 * instead of falling back to the text pane.
 */
const PDF_DOCUMENTS = [
  {
    id: "real-ai-chatbot-agent",
    title: "Chatbot hay AI Agent?",
    fileName: "slide.pdf",
    summary: "Bài giảng phân biệt chatbot và agent, giới thiệu AI tools, Agentic AI và kinh nghiệm nghiên cứu LLM/AI Safety.",
    tags: ["ai-agent", "chatbot", "agentic-ai", "llm"],
    level: "intermediate",
    sizeBytes: 5303092,
  },
  {
    id: "real-react-agentic",
    title: "Từ Chatbot đến Agentic Agent — Design Pattern ReAct",
    fileName: "slide2.pdf",
    summary: "Học liệu AICB-P1 về ba kiểu hệ thống AI, Agentic Fit Framework, kiến trúc Agent, ReAct Pattern, Agent Loop và debugging.",
    tags: ["react", "agent", "agent-loop", "design-pattern"],
    level: "intermediate",
    sizeBytes: 541501,
  },
  {
    id: "real-ai-llm-foundation",
    title: "AI & LLM Foundation — 78 trang",
    fileName: "Slide_AI_Full_78_Trang.pdf",
    summary: "Tài liệu nền tảng về bức tranh AI, cách LLM hoạt động, token economy, gọi API lần đầu, vibe coding và bài tập thực hành.",
    tags: ["ai", "llm", "foundation", "token", "api"],
    level: "beginner",
    sizeBytes: 5801034,
  },
  {
    id: "real-ai-mai-anh",
    title: "Slide AI — Mai Anh Nguyễn",
    fileName: "Slide_AI_Mai_Anh_Nguyen.pdf",
    summary: "Bộ slide học tập AI được chia sẻ trong kho tài liệu nội bộ của dự án.",
    tags: ["ai", "lecture", "slide", "learning"],
    level: "all",
    sizeBytes: 38753534,
  },
];

const ROOMS = [
  { id: "room-agent", name: "AI Agent & ReAct Framework", emoji: "🤖", description: "Thảo luận về mô hình suy luận ReAct, Tool Calling và tự động hóa tác vụ." },
  { id: "room-prompt", name: "Prompt & Context Engineering", emoji: "📝", description: "Chia sẻ kỹ thuật viết Instruction, Context Window và nén thông tin." },
  { id: "room-rag", name: "RAG & Tri Thức Hợp Lệ", emoji: "📚", description: "Trao đổi giải pháp trích xuất văn bản, Vector Search và loại bỏ Hallucination." },
  { id: "room-general", name: "Thảo Luận Học Tập Chung", emoji: "💬", description: "Giao lưu, kết nối bạn học và trao đổi các tài liệu trên VShare." },
];

const MESSAGES = [
  { roomId: "room-agent", userId: "user_viet", userName: "Việt Nguyễn", content: "Chào mọi người! Có bạn nào đang thử áp dụng Tool Calling với Gemini không?", createdAt: "2026-07-30T10:15:00.000Z" },
  { roomId: "room-agent", userId: "user_admin", userName: "Quản trị VShare", content: "Chào Việt! Bạn nên tham khảo bài '4 tiêu chí: Khi nào nên dùng AI Agent' trên VShare nhé.", createdAt: "2026-07-30T10:18:00.000Z" },
  { roomId: "room-prompt", userId: "user_minh", userName: "Minh Phạm", content: "System Instruction cho RAG nên chia rõ 4 phần: Instruction, Context, Input Data và Output Format.", createdAt: "2026-07-30T11:05:00.000Z" },
  { roomId: "room-rag", userId: "user_lan", userName: "Lan Trần", content: "Kho RAG đã đọc full-text từ catalog và file upload rồi nhé!", createdAt: "2026-07-30T14:22:00.000Z" },
  { roomId: "room-general", userId: "user_nam", userName: "Nam Hoàng", content: "Chào mừng các bạn đến với phòng thảo luận chung của VShare!", createdAt: "2026-07-30T09:00:00.000Z" },
];

const RATINGS = [
  { documentId: "doc-agent-criteria", userName: "Minh Phạm", rating: 5, comment: "Tài liệu rất hay và đúng trọng tâm!", createdAt: "2026-07-28T08:00:00.000Z" },
  { documentId: "doc-agent-criteria", userName: "Lan Trần", rating: 4, comment: "Rất hữu ích cho bài tập về nhà.", createdAt: "2026-07-29T08:00:00.000Z" },
  { documentId: "real-react-agentic", userName: "Việt Nguyễn", rating: 5, comment: "Slide ReAct giải thích Agent Loop rất dễ hiểu.", createdAt: "2026-07-30T08:00:00.000Z" },
];

export async function buildSeed() {
  const catalog = JSON.parse(await fs.readFile(paths.catalogFile, "utf8"));
  const createdAt = nowIso();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const users = DEMO_USERS.map((user) => ({
    ...user, passwordHash, status: "active", avatarUrl: "", createdAt, updatedAt: createdAt,
  }));

  const admin = users[0];
  const members = users.filter((user) => user.role === "member");

  const pdfDocuments = await Promise.all(PDF_DOCUMENTS.map(async (doc) => {
    const file = path.join(paths.library, doc.fileName);
    let extraction;
    let extractionError = "";

    try {
      extraction = await extractPdfText(file);
    } catch (error) {
      extraction = { text: "", pageCount: 0, charCount: 0 };
      extractionError = error.message || "PDF extraction failed";
    }

    const extracted = extraction.charCount > 0;
    return {
      ...doc,
      content: extracted ? extraction.text : doc.summary,
      textExtraction: {
        status: extracted ? "extracted" : "unavailable",
        pageCount: extraction.pageCount,
        charCount: extraction.charCount,
        ...(extractionError ? { error: extractionError } : {}),
      },
      category: "Tài liệu",
      source: "official",
      date: "2026-07-30",
      available: true,
      status: "published",
      ownerId: admin.id,
      ownerName: admin.displayName,
      fileUrl: `/library/${encodeURIComponent(doc.fileName)}`,
      mimeType: "application/pdf",
      downloadCount: 0,
      createdAt,
      updatedAt: createdAt,
    };
  }));

  // Spread the text catalog across members so the contributor board is not a
  // single-row list.
  const catalogDocuments = catalog.map((doc, index) => {
    const owner = members[index % members.length];
    return {
      ownerId: owner.id,
      ownerName: owner.displayName,
      category: doc.category || "Kiến thức",
      status: "published",
      downloadCount: 0,
      fileUrl: doc.fileUrl || "",
      fileName: doc.fileName || "",
      createdAt: doc.date ? `${doc.date}T00:00:00.000Z` : createdAt,
      updatedAt: createdAt,
      ...doc,
    };
  });

  return {
    users,
    sessions: [],
    documents: [...pdfDocuments, ...catalogDocuments],
    rooms: ROOMS,
    roomMessages: MESSAGES.map((message, index) => ({ id: `msg_seed_${index + 1}`, ...message })),
    ratings: RATINGS.map((rating, index) => ({ id: `rating_seed_${index + 1}`, ...rating })),
  };
}

export { DEMO_PASSWORD };
