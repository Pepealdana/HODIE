import assert from "node:assert/strict";
import fs from "node:fs";
import { registerEvidence } from "../src/learning-engine.js";
import { createNextActivityPlan } from "../src/learning-planner.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

let profile = { evidence: [], reviews: [] };
const result = registerEvidence(matrix, profile, {
  canDoId: "SP-A2-02",
  independent: false,
  contextId: "family-1",
  confidence: 2,
  dimensions: { taskCompletion: 0.5, grammar: 0.4, fluency: 0.6 },
  errors: [{ priority: "high", type: "grammar", target: "be", message: "Needs support with be." }]
});

const plan = createNextActivityPlan(matrix, library, result);
assert.equal(plan.canDoId, "SP-A2-02");
assert.equal(plan.gap.target, "be");
assert.equal(plan.stages.at(-1).kind, "retry");
assert.equal(plan.stages.at(-1).activity.id, "ACT-SP-A2-02-01");

const successProfile = { evidence: [], reviews: [] };
const successResult = registerEvidence(matrix, successProfile, {
  canDoId: "SP-A2-01",
  independent: true,
  contextId: "work-1",
  confidence: 4,
  dimensions: {
    taskCompletion: 1,
    grammar: 0.9,
    fluency: 0.9,
    vocabulary: 0.9,
    pronunciation: 0.9
  }
});
const nextPlan = createNextActivityPlan(matrix, library, successResult, {
  now: "2026-10-07T12:00:00.000Z",
  contextTerms: ["technology", "teacher", "work"]
});
assert.equal(nextPlan.canDoId, "SP-A2-02");
assert.equal(nextPlan.stages.length, 1);
assert.equal(nextPlan.stages[0].kind, "target");

console.log("HODIE Learning Engine -> Activity Generator integration: PASS");
