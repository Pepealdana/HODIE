import assert from "node:assert/strict";
import {
  getStatus,
  identifyGap,
  registerEvidence,
  selectNextCanDo
} from "../src/learning-engine.js";

const matrix = {
  canDos: [
    {
      id: "SP-A2-01",
      skill: "speaking",
      level: "A2",
      priority: "high",
      canDo: "I can introduce myself.",
      prerequisites: [],
      recovery: [],
      evidence: { type: "speaking", task: "Introduce yourself." },
      feedback: { languages: ["en", "es"], requireRetryForPriorityErrors: true }
    },
    {
      id: "SP-A2-02",
      skill: "speaking",
      level: "A2",
      priority: "critical",
      canDo: "I can talk about my family.",
      prerequisites: ["SP-A2-01"],
      recovery: ["SP-A2-01"],
      evidence: { type: "speaking", task: "Talk about your family." },
      feedback: { languages: ["en", "es"], requireRetryForPriorityErrors: true }
    }
  ]
};

let profile = { evidence: [], reviews: [] };

assert.equal(getStatus(matrix.canDos[0], profile), "notStarted");

const first = registerEvidence(matrix, profile, {
  canDoId: "SP-A2-01",
  independent: true,
  contextId: "intro-1",
  confidence: 4,
  dimensions: {
    taskCompletion: 0.9,
    grammar: 0.8,
    fluency: 0.8,
    vocabulary: 0.8,
    pronunciation: 0.8
  }
});
profile = first.profile;
assert.equal(first.canDo.status, "functional");

const next = selectNextCanDo(matrix, profile);
assert.equal(next.id, "SP-A2-02");

const failed = registerEvidence(matrix, profile, {
  canDoId: "SP-A2-02",
  independent: false,
  contextId: "family-1",
  confidence: 2,
  dimensions: { taskCompletion: 0.5, fluency: 0.4 },
  errors: [{ priority: "high", type: "grammar", target: "be", message: "Needs support with be." }]
});
assert.equal(failed.gap.type, "grammar");
assert.equal(failed.retryRequired, true);
assert.deepEqual(failed.recovery, ["SP-A2-01"]);

console.log("HODIE Learning Engine v0.2 tests: PASS");
