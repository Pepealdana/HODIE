import assert from "node:assert/strict";
import fs from "node:fs";
import { runLearningCycle } from "../src/learning-cycle.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

const emptyProfile = {
  evidence: [],
  reviews: []
};

const failed = runLearningCycle(matrix, library, emptyProfile, {
  canDoId: "SP-A2-02",
  independent: false,
  contextId: "family-1",
  confidence: 2,
  dimensions: {
    taskCompletion: 0.5,
    grammar: 0.4,
    fluency: 0.6
  },
  errors: [
    {
      priority: "high",
      type: "grammar",
      target: "be",
      message: "Needs support with be."
    }
  ]
});

assert.equal(failed.result.canDo.id, "SP-A2-02");
assert.equal(failed.result.gap.target, "be");
assert.equal(failed.result.retryRequired, true);
assert.equal(failed.nextSession.target.canDoId, "SP-A2-02");
assert.equal(failed.nextSession.mode, "recovery");
assert.equal(failed.nextSession.stages.at(-1).kind, "retry");
assert.equal(failed.nextSession.stages.at(-1).activity.id, "ACT-SP-A2-02-01");

assert.equal(emptyProfile.evidence.length, 0);
assert.equal(emptyProfile.reviews.length, 0);

const successful = runLearningCycle(matrix, library, emptyProfile, {
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
}, {
  now: "2026-10-07T12:00:00.000Z",
  contextTerms: ["technology", "teacher", "work"]
});

assert.equal(successful.result.canDo.id, "SP-A2-01");
assert.equal(successful.result.retryRequired, false);
assert.ok(successful.nextSession.target);
assert.equal(successful.nextSession.target.canDoId, "SP-A2-02");
assert.equal(successful.nextSession.completion.evidenceRequired, true);

assert.equal(successful.result.profile.evidence.length, 1);
assert.equal(emptyProfile.evidence.length, 0);

console.log("HODIE Learning Cycle v1: PASS");
