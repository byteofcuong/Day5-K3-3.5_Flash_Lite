import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];
    if (current === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (current === '"') {
      quoted = !quoted;
    } else if (current === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((current === "\n" || current === "\r") && !quoted) {
      if (current === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += current;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }

  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

test("golden set matches the rubric and only expects real PDF documents", async () => {
  const text = await fs.readFile(new URL("../../eval/golden-set.csv", import.meta.url), "utf8");
  const cases = parseCsv(text);
  const allowedDocuments = new Set([
    "real-ai-chatbot-agent",
    "real-react-agentic",
    "real-ai-llm-foundation",
    "real-ai-mai-anh",
  ]);

  assert.equal(cases.length, 20);
  assert.equal(cases.filter((item) => item.type === "normal").length, 10);
  assert.equal(cases.filter((item) => item.type === "hard").length, 8);
  assert.equal(cases.filter((item) => item.type === "rare").length, 2);
  assert.ok(cases.filter((item) => item.source_kind === "chatlog" && item.source_ref).length >= 10);

  for (const hardClass of ["1", "2", "3", "4"]) {
    assert.equal(
      cases.filter((item) => item.type === "hard" && item.hard_class === hardClass).length,
      2,
    );
  }

  for (const item of cases) {
    for (const id of item.expected_doc_ids.split("|").filter(Boolean)) {
      assert.ok(allowedDocuments.has(id), `${item.case_id} expects non-PDF document ${id}`);
    }
  }
});
