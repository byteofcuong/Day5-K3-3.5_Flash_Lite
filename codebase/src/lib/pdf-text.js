import fs from "node:fs/promises";
import pdf from "pdf-parse/lib/pdf-parse.js";

function normalizePdfText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfText(file) {
  const buffer = await fs.readFile(file);
  const parsed = await pdf(buffer);
  const text = normalizePdfText(parsed.text);

  return {
    text,
    pageCount: Number(parsed.numpages) || 0,
    charCount: text.length,
  };
}
