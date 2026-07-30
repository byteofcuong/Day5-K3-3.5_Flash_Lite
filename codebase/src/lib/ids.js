import crypto from "node:crypto";

export const newId = (prefix) => `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
export const nowIso = () => new Date().toISOString();
export const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
