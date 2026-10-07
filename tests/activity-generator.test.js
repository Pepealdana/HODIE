import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromEvidence } from "../src/activity-generator.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

const plan = generateFromEvidence(
  matrix,
  library,
  "SP-A2-02",
  {
    dimensions: { taskCompletion: 0.5, grammar: 0.4, fluency: 0.6 },
    confidence: 2,
    independent: false,
    errors: [{
      priority: "high",
      type: "grammar",
      target: "be",
      message: "Needs support with be."
    }]
  }
);

assert.equal(plan.canDoId, "SP-A2-02");
assert.equal(plan.gap.type, "grammar");
assert.equal(plan.gap.target, "be");
assert.equal(plan.stages.at(-1).kind, "retry");
assert.equal(plan.stages.at(-1).activity.id, "ACT-SP-A2-02-01");
assert.equal(plan.selection.recoveryGenerated, true);
assert.match(plan.stages[0].activity.title, /be/i);

const clean = generateFromEvidence(
  matrix,
  library,
  "SP-A2-01",
  {
    dimensions: { taskCompletion: 0.9, grammar: 0.8, fluency: 0.8, vocabulary: 0.8, pronunciation: 0.8 },
    confidence: 4,
    independent: true,
    errors: []
  }
);

assert.equal(clean.gap.type, "none");
assert.equal(clean.stages.length, 1);
assert.equal(clean.stages[0].kind, "target");

console.log("HODIE Activity Generator integration tests: PASS");
