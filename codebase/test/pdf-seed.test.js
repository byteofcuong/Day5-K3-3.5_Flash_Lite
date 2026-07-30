import test from "node:test";
import assert from "node:assert/strict";
import { buildSeed } from "../src/store/seed.js";

test("seed extracts searchable text from backend PDF documents", async () => {
  const collections = await buildSeed();
  const pdfs = collections.documents.filter((doc) => doc.mimeType === "application/pdf");

  assert.equal(pdfs.length, 4);

  const extracted = pdfs.filter((doc) => doc.textExtraction.status === "extracted");
  assert.equal(extracted.length, 3);
  assert.ok(extracted.every((doc) => doc.content.length === doc.textExtraction.charCount));
  assert.ok(extracted.every((doc) => doc.content.length > doc.summary.length));

  const unavailable = pdfs.find((doc) => doc.fileName === "Slide_AI_Mai_Anh_Nguyen.pdf");
  assert.equal(unavailable.textExtraction.status, "unavailable");
  assert.equal(unavailable.content, unavailable.summary);
});
