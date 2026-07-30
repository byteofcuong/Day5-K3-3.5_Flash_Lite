import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.mw.js";
import { toPublicUser } from "../repositories/users.repo.js";
import { login, logout, register } from "../services/auth.service.js";

export const authRoutes = Router();

authRoutes.post("/register", asyncHandler(async (request, response) => {
  const result = await register({ ...request.body, userAgent: request.headers["user-agent"] });
  response.status(201).json(result);
}));

authRoutes.post("/login", asyncHandler(async (request, response) => {
  response.json(await login({ ...request.body, userAgent: request.headers["user-agent"] }));
}));

authRoutes.get("/me", requireAuth, (request, response) => {
  response.json({ user: toPublicUser(request.auth.user) });
});

authRoutes.post("/logout", requireAuth, asyncHandler(async (request, response) => {
  response.json(await logout(request.auth.sessionId));
}));
