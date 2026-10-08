import assert from "node:assert/strict";
import fs from "node:fs";
import {
  rankLearningTargets,
  selectNextLearningTarget,
  selectNextActivityTarget,
  explainSelection,
  getProgressionContext,
  getRetentionEntry,
  retentionBonus,
  progressionFitBonus
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


{
  const masteredProfile = {
    evidence: [
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "work",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      },
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "home",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      }
    ],
    reviews: [
      {
        canDoId: "SP-A2-01",
        nextReviewAt: "2026-09-01T12:00:00.000Z",
        intervalDays: 30
      }
    ]
  };

  const retention = getRetentionEntry(matrix, masteredProfile, "SP-A2-01", { now });
  assert.equal(retention.status, "consolidated");
  assert.equal(retention.retentionState, "due");
  assert.equal(retentionBonus(retention), 3);
}

{
  const progressingProfile = {
    evidence: [
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "work",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      },
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "home",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      }
    ],
    reviews: []
  };

  const progression = getProgressionContext(matrix, progressingProfile, { now });
  assert.equal(progression.currentLevel, "A2");
  assert.equal(progression.nextTargetLevel, "A2+");
  assert.equal(progression.levels.find((item) => item.level === "A2").ready, true);

  const a2Plus = matrix.canDos.find((item) => item.level === "A2+" && item.prerequisites.includes("SP-A2-01"));
  assert.ok(a2Plus);
  assert.equal(progressionFitBonus(progression, a2Plus), 2);
}

{
  const atRiskProfile = {
    evidence: [
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "work",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      },
      {
        canDoId: "SP-A2-01",
        independent: true,
        confidence: 4,
        contextId: "home",
        dimensions: { taskCompletion: 0.9, grammar: 0.9, fluency: 0.9 }
      }
    ],
    reviews: [
      {
        canDoId: "SP-A2-01",
        nextReviewAt: "2026-08-01T12:00:00.000Z",
        intervalDays: 30
      }
    ]
  };

  const rankedMaintenance = rankLearningTargets(matrix, atRiskProfile, { now });
  const maintenanceTarget = rankedMaintenance.find((item) => item.canDo.id === "SP-A2-01");
  assert.ok(maintenanceTarget);
  assert.ok(maintenanceTarget.score > 0);

  const maintenanceExplanation = explainSelection(
    matrix,
    atRiskProfile,
    matrix.canDos.find((item) => item.id === "SP-A2-01"),
    { now }
  );
  assert.ok(maintenanceExplanation.reasons.includes("retention is at risk"));
}

console.log("HODIE Adaptive Planner v2 progression/retention: PASS");
