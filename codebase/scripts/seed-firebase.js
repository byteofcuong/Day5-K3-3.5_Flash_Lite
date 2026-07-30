import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "../src/firebase.js";

const passwordHash = await bcrypt.hash("VShare@2026", 12);
const now = new Date().toISOString();

const users = [
  { id: "user-admin", email: "admin@vshare.local", displayName: "Quản trị VShare", role: "admin", bio: "Quản trị viên kho học liệu." },
  { id: "user-viet", email: "viet@vshare.local", displayName: "Việt Nguyễn", role: "member", bio: "Quan tâm đến AI Agent và xây dựng sản phẩm." },
  { id: "user-minh", email: "minh@vshare.local", displayName: "Minh Phạm", role: "member", bio: "Chia sẻ tài liệu về ReAct và Agentic AI." },
  { id: "user-lan", email: "lan@vshare.local", displayName: "Lan Trần", role: "member", bio: "Học viên AI & LLM Foundation." },
  { id: "user-nam", email: "nam@vshare.local", displayName: "Nam Hoàng", role: "member", bio: "Yêu thích cộng đồng học tập mở." },
].map((user) => ({
  ...user, passwordHash, status: "active", avatarUrl: "", documentCount: user.id === "user-admin" ? 4 : 0,
  createdAt: now, updatedAt: now,
}));

const documents = [
  {
    id: "real-ai-chatbot-agent", title: "Chatbot hay AI Agent?", fileName: "slide.pdf",
    summary: "Bài giảng phân biệt chatbot và agent, giới thiệu AI tools, Agentic AI và kinh nghiệm nghiên cứu LLM/AI Safety.",
    tags: ["ai-agent", "chatbot", "agentic-ai", "llm"], level: "intermediate",
    sizeBytes: 5303092,
  },
  {
    id: "real-react-agentic", title: "Từ Chatbot đến Agentic Agent — Design Pattern ReAct", fileName: "slide2.pdf",
    summary: "Học liệu AICB-P1 về ba kiểu hệ thống AI, Agentic Fit Framework, kiến trúc Agent, ReAct Pattern, Agent Loop và debugging.",
    tags: ["react", "agent", "agent-loop", "design-pattern"], level: "intermediate",
    sizeBytes: 541501,
  },
  {
    id: "real-ai-llm-foundation", title: "AI & LLM Foundation — 78 trang", fileName: "Slide_AI_Full_78_Trang.pdf",
    summary: "Tài liệu nền tảng về bức tranh AI, cách LLM hoạt động, token economy, gọi API lần đầu, vibe coding và bài tập thực hành.",
    tags: ["ai", "llm", "foundation", "token", "api"], level: "beginner",
    sizeBytes: 5801034,
  },
  {
    id: "real-ai-mai-anh", title: "Slide AI — Mai Anh Nguyễn", fileName: "Slide_AI_Mai_Anh_Nguyen.pdf",
    summary: "Bộ slide học tập AI của giảng viên Mai Anh Nguyễn, được chia sẻ trong kho tài liệu nội bộ của dự án.",
    tags: ["ai", "lecture", "slide", "learning"], level: "all",
    sizeBytes: 38753534,
  },
].map((document) => ({
  ...document, category: "Tài liệu", source: "official", date: "2026-07-30",
  available: true, status: "published", ownerId: "user-admin", ownerName: "Quản trị VShare",
  fileUrl: `/library/${encodeURIComponent(document.fileName)}`, mimeType: "application/pdf",
  downloadCount: 0, createdAt: now, updatedAt: now,
}));

const communityPosts = [
  { id: "post-viet-agent-notes", authorId: "user-viet", authorName: "Việt Nguyễn", title: "Ghi chú cách chọn bài toán phù hợp cho AI Agent", content: "Chia sẻ bốn tiêu chí đánh giá trước khi quyết định dùng agent.", category: "Kiến thức", createdAt: "2026-07-30T09:00:00.000Z" },
  { id: "post-viet-context", authorId: "user-viet", authorName: "Việt Nguyễn", title: "Checklist Context Engineering", content: "Tổng hợp Write, Select, Compress và Isolate để quản lý context.", category: "Kiến thức", createdAt: "2026-07-30T10:00:00.000Z" },
  { id: "post-viet-demo", authorId: "user-viet", authorName: "Việt Nguyễn", title: "Kinh nghiệm chuẩn bị demo AI có bằng chứng", content: "Một checklist ngắn để chuẩn bị trace, golden set và failure cases.", category: "Kiến thức", createdAt: "2026-07-30T11:00:00.000Z" },
  { id: "post-minh-react", authorId: "user-minh", authorName: "Minh Phạm", title: "ReAct loop hoạt động như thế nào?", content: "Giải thích vòng lặp Reason, Act, Observe qua ví dụ tìm tài liệu.", category: "Kiến thức", createdAt: "2026-07-30T09:30:00.000Z" },
  { id: "post-minh-tools", authorId: "user-minh", authorName: "Minh Phạm", title: "Phân biệt workflow và tool-calling agent", content: "Workflow chạy theo nhánh cố định, agent tự chọn công cụ theo trạng thái.", category: "Kiến thức", createdAt: "2026-07-30T10:30:00.000Z" },
  { id: "post-lan-foundation", authorId: "user-lan", authorName: "Lan Trần", title: "Lộ trình học LLM Foundation cho người mới", content: "Bắt đầu từ token, transformer, prompt rồi mới chuyển sang agent.", category: "Kiến thức", createdAt: "2026-07-30T08:30:00.000Z" },
  { id: "post-nam-community", authorId: "user-nam", authorName: "Nam Hoàng", title: "Cách mô tả tài liệu để cộng đồng dễ tìm", content: "Tiêu đề rõ ràng, mô tả có mục tiêu học và tags thống nhất.", category: "Khác", createdAt: "2026-07-30T08:00:00.000Z" },
];

const batch = db().batch();
for (const user of users) {
  const { id, ...data } = user;
  batch.set(db().collection("users").doc(id), data, { merge: true });
}

const existing = await db().collection("documents").get();
for (const snapshot of existing.docs) {
  if (!documents.some((document) => document.id === snapshot.id)) {
    batch.set(snapshot.ref, { available: false, status: "archived", updatedAt: now }, { merge: true });
  }
}

for (const document of documents) {
  const { id, ...data } = document;
  batch.set(db().collection("documents").doc(id), data, { merge: true });
  batch.set(db().collection("posts").doc(`post-${id}`), {
    authorId: document.ownerId, authorName: document.ownerName, documentId: id,
    title: document.title, content: document.summary, category: document.category,
    status: "published", likeCount: id === "real-ai-llm-foundation" ? 3 : 1,
    commentCount: 0, createdAt: now, updatedAt: now,
  }, { merge: true });
}

for (const post of communityPosts) {
  const { id, ...data } = post;
  batch.set(db().collection("posts").doc(id), {
    ...data, documentId: null, status: "published", likeCount: 0,
    commentCount: 0, updatedAt: data.createdAt,
  }, { merge: true });
}

const interactions = [
  ["user-viet", "real-react-agentic", "bookmark"],
  ["user-viet", "real-ai-chatbot-agent", "like"],
  ["user-minh", "real-react-agentic", "like"],
  ["user-lan", "real-ai-llm-foundation", "bookmark"],
  ["user-nam", "real-ai-llm-foundation", "like"],
];
for (const [userId, documentId, type] of interactions) {
  batch.set(db().collection("documentInteractions").doc(`${userId}_${documentId}_${type}`), { userId, documentId, type, createdAt: now }, { merge: true });
}

await batch.commit();
console.log(`Seeded ${users.length} users, ${documents.length} real documents, ${documents.length + communityPosts.length} posts and ${interactions.length} interactions.`);
console.log("Demo password for all seeded accounts: VShare@2026");
