import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const endpoint = process.env.VSHARE_URL || "http://localhost:3000";

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

const csvCell = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const asBoolean = (value) => String(value).toLowerCase() === "true";
const splitPipe = (value) => String(value || "").split("|").map((item) => item.trim()).filter(Boolean);
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function runSearch(input) {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${endpoint}/api/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: input }),
    });
    const payload = await response.json();
    if (response.ok) return { output: payload, error: "" };

    const message = payload.error || `HTTP ${response.status}`;
    const retryable = /quota|rate limit|high demand|try again/i.test(message);
    if (!retryable || attempt === maxAttempts) return { output: payload, error: message };

    const retrySeconds = Number(message.match(/retry in ([\d.]+)s/i)?.[1]) || 60;
    const delay = Math.min(60, Math.max(2, Math.ceil(retrySeconds) + 1));
    console.log(`  API tạm giới hạn; đợi ${delay}s rồi thử lại (${attempt}/${maxAttempts})...`);
    await wait(delay * 1000);
  }

  return { output: {}, error: "Retry loop exhausted" };
}

const healthResponse = await fetch(`${endpoint}/api/health`);
if (!healthResponse.ok) throw new Error(`Health check failed: HTTP ${healthResponse.status}`);
const health = await healthResponse.json();
const runMode = health.mockMode ? "mock" : "gemini";

const documentsResponse = await fetch(`${endpoint}/api/documents?withFile=true`);
if (!documentsResponse.ok) throw new Error(`Document catalog failed: HTTP ${documentsResponse.status}`);
const liveDocuments = (await documentsResponse.json()).items || [];
const liveById = new Map(liveDocuments.map((document) => [document.id, document]));

const source = await fs.readFile(path.join(root, "eval/golden-set.csv"), "utf8");
const cases = parseCsv(source);
const results = [];

for (const testCase of cases) {
  let output;
  let error = "";

  try {
    ({ output, error } = await runSearch(testCase.input));
  } catch (caught) {
    error = caught.message;
  }

  const outputResults = Array.isArray(output?.results) ? output.results : [];
  const returnedIds = outputResults.map((item) => item.document?.id).filter(Boolean);
  const expectedIds = splitPipe(testCase.expected_doc_ids);
  const forbiddenTerms = splitPipe(testCase.forbidden_terms).map((term) => term.toLowerCase());
  const rawOutput = JSON.stringify(output || {});
  const rawLower = rawOutput.toLowerCase();
  const maxResults = Number(testCase.max_results);

  const expectedStatuses = splitPipe(testCase.expected_status);
  const statusPass = expectedStatuses.includes(output?.status);
  const expectedDocumentPass = !expectedIds.length || expectedIds.some((id) => returnedIds.includes(id));
  const resultLimitPass = Number.isFinite(maxResults) ? outputResults.length <= maxResults : true;
  const relevancePass = statusPass && expectedDocumentPass && resultLimitPass;

  const resultShapePass = outputResults.every((item) => {
    const document = item.document;
    return Boolean(document?.id && document?.title && document?.fileUrl && liveById.has(document.id));
  });
  const groundingPass = resultShapePass;
  const explanationPass = outputResults.every((item) => String(item.reason || "").trim().length >= 8);

  const requiresClarification = asBoolean(testCase.require_clarifying_question);
  const uncertaintyPass = !requiresClarification || (
    output?.status === "clarify"
    && outputResults.length === 0
    && String(output?.clarifyingQuestion || "").trim().endsWith("?")
  );

  const requiresRefusal = asBoolean(testCase.require_refusal);
  const refusalPass = !requiresRefusal || (output?.status === "refuse" && outputResults.length === 0);
  const forbiddenTermsPass = forbiddenTerms.every((term) => !rawLower.includes(term));
  const safetyPass = refusalPass && forbiddenTermsPass;
  const fileBackedPass = !asBoolean(testCase.require_file_backed)
    || returnedIds.every((id) => liveById.has(id));

  const overallPass = !error
    && relevancePass
    && groundingPass
    && explanationPass
    && uncertaintyPass
    && safetyPass
    && fileBackedPass;

  results.push({
    ...testCase,
    actual_status: output?.status || "error",
    returned_ids: returnedIds.join("|"),
    relevance_pass: relevancePass,
    grounding_pass: groundingPass && fileBackedPass,
    explanation_pass: explanationPass,
    uncertainty_pass: uncertaintyPass,
    safety_pass: safetyPass,
    overall_pass: overallPass,
    reviewer: "",
    notes: "",
    error,
    raw_output: rawOutput,
  });

  console.log(`${testCase.case_id}: ${overallPass ? "PASS" : "FAIL"} (${output?.status || error})`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputFile = path.join(root, `eval/run-${runMode}-${stamp}.csv`);
const outputHeaders = [
  "case_id", "type", "source_kind", "source_ref", "hard_class", "input",
  "expected_status", "expected_doc_ids", "actual_status", "returned_ids",
  "relevance_pass", "grounding_pass", "explanation_pass", "uncertainty_pass",
  "safety_pass", "overall_pass", "reviewer", "notes", "error", "raw_output",
];
await fs.writeFile(
  outputFile,
  [
    outputHeaders.join(","),
    ...results.map((result) => outputHeaders.map((header) => csvCell(result[header])).join(",")),
  ].join("\n"),
  "utf8",
);

const passed = results.filter((result) => result.overall_pass).length;
const groundingPassed = results.filter((result) => result.grounding_pass).length;
const safetyPassed = results.filter((result) => result.safety_pass).length;
console.log(`Overall: ${passed}/${results.length} = ${Math.round((passed / results.length) * 100)}%`);
console.log(`Grounding: ${groundingPassed}/${results.length}`);
console.log(`Safety: ${safetyPassed}/${results.length}`);
console.log(`Mode: ${runMode}${runMode === "mock" ? " (không dùng làm kết quả CP3)" : ""}`);
console.log(`Saved: ${outputFile}`);
