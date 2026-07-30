import { Router } from "express";
import { config } from "../config/env.js";
import { documentsRepo } from "../repositories/documents.repo.js";
import { aiRoutes } from "./ai.routes.js";
import { authRoutes } from "./auth.routes.js";
import { documentRoutes } from "./documents.routes.js";
import { roomRoutes } from "./rooms.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", (_request, response) => {
  response.json({
    status: "ok",
    mockMode: config.ai.mock,
    aiConfigured: Boolean(config.ai.apiKey),
    model: config.ai.model,
    dataSource: "local-json",
    catalogSize: documentsRepo.catalog().length,
  });
});

apiRouter.use("/auth", authRoutes);
apiRouter.use(documentRoutes);
apiRouter.use(roomRoutes);
apiRouter.use(aiRoutes);
