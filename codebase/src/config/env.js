import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const paths = {
  src: path.resolve(here, ".."),
  root: path.resolve(here, "../.."),
  get data() { return path.join(this.root, "data"); },
  get dbFile() { return path.join(this.root, "data", "db.json"); },
  get catalogFile() { return path.join(this.root, "data", "catalog.json"); },
  get public() { return path.join(this.root, "public"); },
  get uploads() { return path.join(this.root, "uploads"); },
  get traces() { return path.join(this.root, "traces"); },
  get library() { return path.join(this.root, "..", "backend", "docs"); },
};

const int = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const config = {
  port: int(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || "development",
  isTest: process.env.NODE_ENV === "test",

  jwt: {
    secret: process.env.JWT_SECRET || "",
    expiresIn: process.env.JWT_EXPIRES_IN || "2h",
    issuer: "vshare-api",
    audience: "vshare-web",
    sessionTtlMs: 2 * 60 * 60 * 1000,
  },

  ai: {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    mock: process.env.ENABLE_MOCK_AI === "true",
    maxAgentSteps: 4,
  },

  upload: {
    maxBytes: 20 * 1024 * 1024,
    allowedExtensions: new Set([".pdf", ".docx", ".xlsx", ".pptx", ".txt", ".md", ".png", ".jpg", ".jpeg", ".zip"]),
  },
};

/**
 * Fails fast on misconfiguration instead of throwing per-request from deep in
 * the call stack, which is how the previous version surfaced a missing secret.
 */
export function assertConfig() {
  const problems = [];
  if (config.jwt.secret.length < 32) problems.push("JWT_SECRET phải có ít nhất 32 ký tự.");
  if (!config.ai.mock && !config.ai.apiKey) {
    problems.push("GEMINI_API_KEY chưa được cấu hình (hoặc bật ENABLE_MOCK_AI=true).");
  }
  if (problems.length) {
    throw new Error(`Cấu hình không hợp lệ:\n  - ${problems.join("\n  - ")}`);
  }
}
