import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import { paths } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.mw.js";
import { sessionsRepo } from "./repositories/sessions.repo.js";
import { apiRouter } from "./routes/index.js";
import { buildSeed } from "./store/seed.js";
import { loadStore } from "./store/json-store.js";

/**
 * Assembles the Express app. Storage is initialised before any route is
 * mounted, so repositories can stay synchronous.
 */
export async function createApp() {
  await fs.mkdir(paths.uploads, { recursive: true });
  await loadStore(buildSeed);
  await sessionsRepo.purgeExpired();

  const app = express();

  app.use(express.json({ limit: "200kb" }));
  app.use(express.static(paths.public));
  app.use("/uploads", express.static(paths.uploads));
  app.use("/library", express.static(paths.library));

  app.use("/api", apiRouter);

  // Unknown /api/* paths get JSON; everything else falls back to the SPA shell.
  app.use(notFoundHandler);
  app.get(/.*/, (_request, response) => response.sendFile(path.join(paths.public, "index.html")));

  app.use(errorHandler);

  return app;
}
