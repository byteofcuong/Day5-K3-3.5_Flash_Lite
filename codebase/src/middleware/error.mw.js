import multer from "multer";
import { config } from "../config/env.js";

export function notFoundHandler(request, response, next) {
  if (!request.path.startsWith("/api/")) return next();
  response.status(404).json({ error: "Endpoint không tồn tại.", code: "ROUTE_NOT_FOUND" });
}

/**
 * Single place that turns any thrown value into the response envelope
 * { error, code }. Route handlers never call response.status() for errors.
 */
export function errorHandler(error, _request, response, _next) {
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE" ? "Tệp vượt quá 20 MB." : error.message;
    return response.status(400).json({ error: message, code: error.code });
  }

  const status = Number(error.status) || 500;
  if (status >= 500) console.error("[error]", error);

  response.status(status).json({
    error: error.message || "Lỗi máy chủ.",
    code: error.code || "INTERNAL_ERROR",
    ...(config.nodeEnv === "development" && status >= 500 ? { stack: error.stack } : {}),
  });
}
