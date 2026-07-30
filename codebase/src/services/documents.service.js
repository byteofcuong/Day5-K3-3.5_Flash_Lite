import fs from "node:fs/promises";
import path from "node:path";
import { badRequest, forbidden, notFound } from "../lib/errors.js";
import { nowIso } from "../lib/ids.js";
import { documentsRepo } from "../repositories/documents.repo.js";
import { ratingsRepo } from "../repositories/ratings.repo.js";
import { usersRepo } from "../repositories/users.repo.js";

const TEXT_EXTENSIONS = new Set([".txt", ".md"]);

/**
 * Public projection of a document. Keeps `content` (the full RAG text, often
 * kilobytes) out of list payloads — the detail endpoint returns it explicitly.
 */
export function toPublicDocument(doc, { includeContent = false } = {}) {
  if (!doc) return null;
  const { content, ...rest } = doc;
  return includeContent ? { ...rest, content: content || "" } : rest;
}

export function listDocuments(options) {
  return documentsRepo.list(options).map((doc) => toPublicDocument(doc));
}

export function getDocument(id, { includeUnavailable = false } = {}) {
  const doc = documentsRepo.findAvailable(id, includeUnavailable);
  if (!doc) throw notFound("Không tìm thấy tài liệu.", "DOCUMENT_NOT_FOUND");
  return doc;
}

async function extractText(file, fallback) {
  const extension = path.extname(file.originalname || "").toLowerCase();
  const isText = TEXT_EXTENSIONS.has(extension) || String(file.mimetype || "").includes("text");
  if (!isText) return fallback;
  try {
    const text = await fs.readFile(file.path, "utf8");
    return text.trim() ? text : fallback;
  } catch {
    return fallback;
  }
}

export async function createDocument({ body, file, user }) {
  const title = String(body.title || "").trim();
  const summary = String(body.summary || "").trim();

  if (title.length < 3) throw badRequest("Tiêu đề cần ít nhất 3 ký tự.", "TITLE_TOO_SHORT");
  if (summary.length < 10) throw badRequest("Mô tả cần ít nhất 10 ký tự.", "SUMMARY_TOO_SHORT");
  if (!file) throw badRequest("Bạn cần chọn một tệp hợp lệ, tối đa 20 MB.", "FILE_REQUIRED");

  const createdAt = nowIso();
  return documentsRepo.insert({
    title,
    summary,
    content: await extractText(file, summary),
    category: body.category || "Tài liệu",
    tags: String(body.tags || "")
      .split(",")
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10),
    level: body.level || "all",
    source: "community",
    date: createdAt.slice(0, 10),
    available: true,
    status: "published",
    ownerId: user.id,
    ownerName: user.displayName,
    fileName: file.originalname,
    fileUrl: `/uploads/${file.filename}`,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    downloadCount: 0,
  });
}

function assertOwnership(doc, user) {
  if (doc.ownerId !== user.id && user.role !== "admin") {
    throw forbidden("Bạn không sở hữu tài liệu này.", "NOT_OWNER");
  }
}

/**
 * Soft delete: the AI catalog and the golden set both rely on unavailable
 * documents still existing so grounding checks can prove they are excluded.
 */
export async function archiveDocument(id, user) {
  const doc = getDocument(id, { includeUnavailable: true });
  assertOwnership(doc, user);
  return documentsRepo.update(id, { available: false, status: "archived" });
}

export async function setVisibility(id, user, available) {
  const doc = getDocument(id, { includeUnavailable: true });
  assertOwnership(doc, user);
  return documentsRepo.update(id, { available: Boolean(available), status: available ? "published" : "archived" });
}

export async function registerDownload(id) {
  const doc = getDocument(id);
  if (!doc.fileUrl) throw notFound("Tài liệu chưa có tệp đính kèm.", "FILE_MISSING");
  await documentsRepo.incrementDownload(id);
  return doc.fileUrl;
}

export function getRatings(documentId) {
  getDocument(documentId, { includeUnavailable: true });
  return ratingsRepo.summary(documentId);
}

export async function addRating({ documentId, rating, comment, user }) {
  getDocument(documentId, { includeUnavailable: true });
  const score = Number(rating);
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw badRequest("Điểm đánh giá phải là số nguyên từ 1 đến 5.", "INVALID_RATING");
  }
  await ratingsRepo.add({
    documentId,
    rating: score,
    comment: String(comment || "").trim().slice(0, 500),
    userId: user?.id || null,
    userName: user?.displayName || "Học viên VShare",
  });
  return ratingsRepo.summary(documentId);
}

/** Ranks contributors by how many published documents they own. */
export function listTopContributors(limit = 5) {
  const size = Math.min(10, Math.max(1, Number(limit) || 5));
  return usersRepo
    .listActive()
    .map((user) => {
      const docs = documentsRepo.list({ ownerId: user.id });
      return {
        userId: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl || "",
        bio: user.bio || "",
        role: user.role,
        documentCount: docs.length,
        topDocumentTitle: docs[0]?.title || "Chưa có tài liệu",
        latestAt: docs[0]?.createdAt || "",
      };
    })
    .filter((contributor) => contributor.documentCount > 0)
    .sort((a, b) => b.documentCount - a.documentCount || String(b.latestAt).localeCompare(String(a.latestAt)))
    .slice(0, size)
    .map((contributor, index) => ({ ...contributor, rank: index + 1 }));
}
