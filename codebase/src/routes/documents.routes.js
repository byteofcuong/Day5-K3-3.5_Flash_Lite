import fs from "node:fs/promises";
import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.mw.js";
import { uploadSingleFile } from "../middleware/upload.mw.js";
import {
  addRating, archiveDocument, createDocument, getDocument, getRatings,
  listDocuments, listTopContributors, registerDownload, setVisibility, toPublicDocument,
} from "../services/documents.service.js";

export const documentRoutes = Router();

documentRoutes.get("/documents", (request, response) => {
  const items = listDocuments({
    category: request.query.category && request.query.category !== "all" ? request.query.category : undefined,
    search: request.query.q,
  });
  response.json({ items, total: items.length });
});

documentRoutes.get("/contributors", (request, response) => {
  response.json({ items: listTopContributors(request.query.limit) });
});

documentRoutes.get("/my/documents", requireAuth, (request, response) => {
  const items = listDocuments({ ownerId: request.auth.user.id, includeUnavailable: true });
  response.json({ items, total: items.length });
});

documentRoutes.post("/documents", requireAuth, uploadSingleFile, asyncHandler(async (request, response) => {
  try {
    const document = await createDocument({ body: request.body, file: request.file, user: request.auth.user });
    response.status(201).json({ document: toPublicDocument(document) });
  } catch (error) {
    // Don't leave an orphan upload on disk when validation rejects the request.
    if (request.file) await fs.unlink(request.file.path).catch(() => {});
    throw error;
  }
}));

documentRoutes.get("/documents/:id", (request, response) => {
  const document = getDocument(request.params.id);
  response.json({ document: toPublicDocument(document, { includeContent: true }) });
});

documentRoutes.get("/documents/:id/download", asyncHandler(async (request, response) => {
  response.redirect(await registerDownload(request.params.id));
}));

documentRoutes.delete("/documents/:id", requireAuth, asyncHandler(async (request, response) => {
  await archiveDocument(request.params.id, request.auth.user);
  response.json({ message: "Đã gỡ tài liệu khỏi kho VShare.", id: request.params.id });
}));

documentRoutes.patch("/documents/:id/visibility", requireAuth, asyncHandler(async (request, response) => {
  const document = await setVisibility(request.params.id, request.auth.user, request.body.available);
  response.json({ document: toPublicDocument(document) });
}));

documentRoutes.get("/documents/:id/ratings", (request, response) => {
  response.json(getRatings(request.params.id));
});

documentRoutes.post("/documents/:id/rate", requireAuth, asyncHandler(async (request, response) => {
  const summary = await addRating({
    documentId: request.params.id,
    rating: request.body.rating,
    comment: request.body.comment,
    user: request.auth.user,
  });
  response.status(201).json(summary);
}));
