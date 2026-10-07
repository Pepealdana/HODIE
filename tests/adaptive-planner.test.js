import assert from "node:assert/strict";
import fs from "node:fs";
import {
  rankLearningTargets,
  selectNextLearningTarget,
  selectNextActivityTarget,
  explainSelection
} from "../src/adaptive-planner.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

const now = "2026-10-07T12:00:00.000Z";

const profile = {
  evidence: [
    {
      canDoId: "SP-A2-01",
      independent: true,
      confidence: 4,
      contextId: "work",
      dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.8 }
    }
  ],
  reviews: [
    {
      canDoId: "SP-A2-01",
      nextReviewAt: "2026-10-06T12:00:00.000Z"
    }
  ]
};

const ranked = rankLearningTargets(matrix, profile, {
  now,
  contextTerms: ["technology", "teacher", "work"]
});

assert.ok(ranked.length > 0);
assert.equal(ranked[0].canDo.id, "SP-A2-02");

const next = selectNextLearningTarget(matrix, profile, {
  now,
  contextTerms: ["technology", "teacher", "work"]
});

assert.equal(next.id, "SP-A2-02");

const activityTarget = selectNextActivityTarget(matrix, library, profile, {
  now,
  contextTerms: ["technology", "teacher", "work"]
});

assert.ok(activityTarget);
assert.ok(library.activities.some((activity) => activity.canDoId === activityTarget.id));

const explanation = explainSelection(matrix, profile, next, {
  now,
  contextTerms: ["technology", "teacher", "work"]
});

assert.equal(explanation.canDoId, "SP-A2-02");
assert.ok(explanation.reasons.length > 0);

console.log("HODIE Adaptive Planner v1: PASS");
