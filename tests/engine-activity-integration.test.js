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

console.log("HODIE Learning Engine -> Activity Generator integration: PASS");
