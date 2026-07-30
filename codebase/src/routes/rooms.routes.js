import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.mw.js";
import { listMessages, listRooms, postMessage } from "../services/rooms.service.js";

export const roomRoutes = Router();

roomRoutes.get("/rooms", (_request, response) => {
  response.json({ items: listRooms() });
});

roomRoutes.get("/rooms/:id/messages", (request, response) => {
  response.json({ roomId: request.params.id, items: listMessages(request.params.id) });
});

// Posting requires a session so messages carry a real author instead of a
// client-supplied display name.
roomRoutes.post("/rooms/:id/messages", requireAuth, asyncHandler(async (request, response) => {
  const message = await postMessage({
    roomId: request.params.id,
    content: request.body.content,
    user: request.auth.user,
  });
  response.status(201).json({ message });
}));
