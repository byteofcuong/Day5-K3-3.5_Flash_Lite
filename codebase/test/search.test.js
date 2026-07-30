import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../data/catalog.json" with { type: "json" };
import { executeAgentTool, mockSearch, parseAndValidate } from "../src/search.js";

test("rejects hallucinated document IDs", () => {
  const result=parseAndValidate(JSON.stringify({status:"results",results:[{documentId:"made-up",reason:"x",confidence:.9}]}),catalog);
  assert.equal(result.status,"none");
  assert.equal(result.results.length,0);
});
test("removes unavailable documents", () => {
  const result=parseAndValidate(JSON.stringify({status:"results",results:[{documentId:"doc-deleted",reason:"x",confidence:.9}]}),catalog);
  assert.equal(result.status,"none");
});
test("mock mode asks clarification for vague query", () => {
  assert.equal(mockSearch("AI",catalog).status,"clarify");
});
test("agent search tool returns only available catalog documents", () => {
  const results=executeAgentTool("search_documents",{query:"context engineering",level:"beginner",limit:3},catalog);
  assert.ok(results.length>0);
  assert.ok(results.length<=3);
  assert.ok(results.every((doc)=>doc.available));
});
test("agent get_document does not expose deleted documents", () => {
  assert.deepEqual(executeAgentTool("get_document",{document_id:"doc-deleted"},catalog),{error:"DOCUMENT_NOT_FOUND"});
});
