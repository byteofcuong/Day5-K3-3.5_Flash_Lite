import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { badRequest } from "../lib/errors.js";
import { documentsRepo } from "../repositories/documents.repo.js";
import { getDocument } from "../services/documents.service.js";
import { search } from "../services/search.service.js";
// Agent entry points — imported as-is, never modified here.
import { chatWithAi, chatWithDocument, generateFlashcards, summarizeDocument } from "../search.js";

export const aiRoutes = Router();

function requireQuery(value) {
  const query = typeof value === "string" ? value.trim() : "";
  if (query.length < 2 || query.length > 500) throw badRequest("Truy vấn phải có từ 2 đến 500 ký tự.", "INVALID_QUERY");
  return query;
}

function requireMessages(value) {
  const messages = Array.isArray(value) ? value : [];
  if (!messages.length) throw badRequest("Tin nhắn không được để trống.", "EMPTY_MESSAGES");
  return messages;
}

aiRoutes.post("/search", asyncHandler(async (request, response) => {
  response.json(await search(requireQuery(request.body.query)));
}));

aiRoutes.post("/chat", asyncHandler(async (request, response) => {
  const messages = requireMessages(request.body.messages);
  response.json(await chatWithAi(messages, request.body.documentId, documentsRepo.catalog()));
}));

aiRoutes.post("/documents/:id/summarize", asyncHandler(async (request, response) => {
  const document = getDocument(request.params.id, { includeUnavailable: true });
  response.json(await summarizeDocument(document));
}));

aiRoutes.post("/documents/:id/chat", asyncHandler(async (request, response) => {
  const messages = requireMessages(request.body.messages);
  const document = getDocument(request.params.id, { includeUnavailable: true });
  response.json(await chatWithDocument(messages, document));
}));

aiRoutes.post("/documents/:id/flashcards", asyncHandler(async (request, response) => {
  const document = getDocument(request.params.id, { includeUnavailable: true });
  response.json({ flashcards: await generateFlashcards(document) });
}));
