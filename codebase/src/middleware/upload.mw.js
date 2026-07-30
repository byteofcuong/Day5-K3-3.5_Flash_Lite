import crypto from "node:crypto";
import path from "node:path";
import multer from "multer";
import { config, paths } from "../config/env.js";

export const uploadSingleFile = multer({
  storage: multer.diskStorage({
    destination: paths.uploads,
    // Generated name: never trust the client filename on disk.
    filename: (_request, file, callback) =>
      callback(null, `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: config.upload.maxBytes },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    callback(null, config.upload.allowedExtensions.has(extension));
  },
}).single("file");
