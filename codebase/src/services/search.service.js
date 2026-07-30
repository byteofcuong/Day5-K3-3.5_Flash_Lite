import fs from "node:fs/promises";
import path from "node:path";
import { config, paths } from "../config/env.js";
import { upstream } from "../lib/errors.js";
import { nowIso } from "../lib/ids.js";
import { documentsRepo } from "../repositories/documents.repo.js";
import { toPublicDocument } from "./documents.service.js";
// The agent itself is untouched — this service only orchestrates it.
import { agentTools, buildAgentInstruction, executeAgentTool, mockSearch, parseAndValidate } from "../search.js";
import { callGeminiApi } from "../ai/llm.provider.js";

async function writeTrace(trace) {
  if (config.isTest) return;
  try {
    await fs.mkdir(paths.traces, { recursive: true });
    await fs.appendFile(path.join(paths.traces, "ai-calls.jsonl"), `${JSON.stringify(trace)}\n`, "utf8");
  } catch (error) {
    console.error("[trace] Không ghi được trace:", error.message);
  }
}

/**
 * Drops any result whose documentId is not a real, available catalog entry.
 *
 * Spec §7 requires every id/title/link in the output to exist in the input
 * catalog; this is the enforcement point. It filters the agent's output — it
 * does not change how the agent reasons.
 */
function groundResults(result, catalog) {
  const byId = new Map(catalog.map((doc) => [doc.id, doc]));
  const incoming = Array.isArray(result.results) ? result.results : [];
  const grounded = [];
  const rejected = [];

  for (const item of incoming) {
    const doc = byId.get(item.documentId);
    if (!doc) {
      rejected.push(item.documentId);
      continue;
    }
    grounded.push({
      documentId: doc.id,
      reason: String(item.reason || "").slice(0, 500),
      confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0)),
      document: toPublicDocument(doc),
    });
  }

  const status = grounded.length ? result.status || "results" : result.status === "results" ? "none" : result.status || "none";
  return {
    result: {
      status,
      message: grounded.length ? result.message || `Tìm thấy ${grounded.length} tài liệu.` : result.message || "Không tìm thấy tài liệu phù hợp trong kho VShare.",
      clarifyingQuestion: result.clarifyingQuestion || null,
      results: grounded.slice(0, 3),
    },
    rejected,
  };
}

/** ReAct loop: Thought → Action(tool) → Observation → Final Answer. */
async function runAgent(query, catalog) {
  const contents = [{ role: "user", parts: [{ text: query }] }];
  const toolTrace = [];
  let rawAnswer = "";

  for (let step = 0; step < config.ai.maxAgentSteps; step += 1) {
    const turn = await callGeminiApi({
      contents,
      systemInstruction: buildAgentInstruction(catalog),
      tools: agentTools,
      temperature: 0.1,
    });

    if (turn.type !== "functionCall") {
      rawAnswer = turn.text || "";
      break;
    }

    const observation = executeAgentTool(turn.name, turn.args || {}, catalog);
    toolTrace.push({ step: step + 1, thought: turn.thought, tool: turn.name, args: turn.args || {}, observation });

    contents.push({ role: "model", parts: [{ functionCall: { name: turn.name, args: turn.args || {} } }] });
    contents.push({ role: "user", parts: [{ functionResponse: { name: turn.name, response: { result: observation } } }] });
  }

  if (!rawAnswer) throw upstream(`Agent vượt quá giới hạn ${config.ai.maxAgentSteps} bước.`, "AGENT_STEP_LIMIT");
  return { rawAnswer, toolTrace };
}

export async function search(query) {
  const catalog = documentsRepo.catalog();
  const mode = config.ai.mock ? "mock" : "gemini";
  const startedAt = Date.now();

  let parsed;
  let toolTrace = [];
  let rawAnswer = "";

  if (mode === "mock") {
    parsed = mockSearch(query, catalog);
  } else {
    try {
      ({ rawAnswer, toolTrace } = await runAgent(query, catalog));
    } catch (error) {
      throw error.status ? error : upstream(error.message || "Không thể gọi AI.");
    }
    parsed = parseAndValidate(rawAnswer, catalog);
  }

  const { result, rejected } = groundResults(parsed, catalog);

  await writeTrace({
    timestamp: nowIso(),
    mode,
    model: config.ai.model,
    query,
    rawOutput: rawAnswer,
    parsedOutput: parsed,
    groundedOutput: result,
    rejectedIds: rejected,
    toolCalls: toolTrace,
    latencyMs: Date.now() - startedAt,
  });

  return { ...result, mode, catalogSize: catalog.length, groundingRejected: rejected.length };
}
