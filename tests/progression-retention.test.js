import assert from "node:assert/strict";
import {
  evaluateLevel,
  evaluateProgression,
  getRetentionPlan,
  getRetentionState
} from "../src/progression-retention.js";

const matrix = {
  canDos: [
    { id: "A2-SP-1", level: "A2", skill: "speaking", canDoType: "communicative" },
    { id: "A2-LI-1", level: "A2", skill: "listening", canDoType: "communicative" },
    { id: "A2-RE-1", level: "A2", skill: "reading", canDoType: "communicative" },
    { id: "A2-WR-1", level: "A2", skill: "writing", canDoType: "communicative" },
    { id: "A2-CO-1", level: "A2", skill: "communication", canDoType: "interaction" },
    { id: "A2-M", level: "A2", skill: "speaking", canDoType: "meta" },

    { id: "A2P-SP-1", level: "A2+", skill: "speaking", canDoType: "communicative" },
    { id: "A2P-LI-1", level: "A2+", skill: "listening", canDoType: "communicative" },
    { id: "A2P-RE-1", level: "A2+", skill: "reading", canDoType: "communicative" },
    { id: "A2P-WR-1", level: "A2+", skill: "writing", canDoType: "communicative" },
    { id: "A2P-CO-1", level: "A2+", skill: "communication", canDoType: "interaction" },

    { id: "B1-SP-1", level: "B1", skill: "speaking", canDoType: "communicative" },
    { id: "B1-LI-1", level: "B1", skill: "listening", canDoType: "communicative" },
    { id: "B1-RE-1", level: "B1", skill: "reading", canDoType: "communicative" },
    { id: "B1-WR-1", level: "B1", skill: "writing", canDoType: "communicative" },
    { id: "B1-CO-1", level: "B1", skill: "communication", canDoType: "interaction" },
    { id: "B1-M1", level: "B1", skill: "speaking", canDoType: "meta" }
  ]
};

const masteredIds = new Set([
  "A2-SP-1", "A2-LI-1", "A2-RE-1", "A2-WR-1", "A2-CO-1", "A2-M",
  "A2P-SP-1", "A2P-LI-1", "A2P-RE-1", "A2P-WR-1", "A2P-CO-1",
  "B1-SP-1", "B1-LI-1", "B1-RE-1", "B1-WR-1", "B1-CO-1", "B1-M1"
]);

const getStatus = (canDo, profile) => {
  const count = (profile.evidence || []).filter((item) => item.canDoId === canDo.id && item.independent).length;
  return count >= 2 ? "consolidated" : count >= 1 ? "functional" : "notStarted";
};

const empty = { evidence: [], reviews: [] };

const allMasteredProfile = { evidence: [], reviews: [] };
const masteredGetStatus = (canDo) => masteredIds.has(canDo.id) ? "consolidated" : "developing";

{
  const a2 = evaluateLevel(matrix, allMasteredProfile, "A2", masteredGetStatus);
  assert.equal(a2.ready, true);
  assert.equal(a2.coverage, 1);
  assert.equal(a2.skillMinimumMet, true);
  assert.equal(a2.metaReady, true);

  const progression = evaluateProgression(matrix, allMasteredProfile, masteredGetStatus);
  assert.equal(progression.currentLevel, "B1");
  assert.equal(progression.readiness, "functional");
  assert.equal(progression.levels.find((item) => item.level === "B1").ready, true);
}


{
  const result = evaluateLevel(matrix, empty, "A2", getStatus);
  assert.equal(result.ready, false);
  assert.equal(result.coverage, 0);
}

{
  const result = evaluateProgression(matrix, empty, getStatus);
  assert.equal(result.currentLevel, "A2");
  assert.equal(result.readiness, "developing");
  assert.equal(result.certification, false);
}

{
  const profile = { evidence: [], reviews: [] };
  const result = evaluateProgression(matrix, profile, getStatus);
  assert.equal(result.levels[0].ready, false);
}

{
  const now = new Date("2026-10-07T12:00:00.000Z");
  const current = getRetentionState(
    { nextReviewAt: "2026-10-08T12:00:00.000Z", intervalDays: 30 },
    now
  );
  assert.equal(current.state, "current");
  assert.equal(current.overdueDays, 0);

  const due = getRetentionState(
    { nextReviewAt: "2026-10-06T12:00:00.000Z", intervalDays: 30 },
    now
  );
  assert.equal(due.state, "due");
  assert.equal(due.overdueDays, 1);

  const atRisk = getRetentionState(
    { nextReviewAt: "2026-09-01T12:00:00.000Z", intervalDays: 10 },
    now
  );
  assert.equal(atRisk.state, "atRisk");
}

assert.deepEqual(getRetentionPlan("consolidated"), {
  intervalDays: 30,
  reason: "maintenance interval after consolidated mastery"
});

assert.deepEqual(getRetentionPlan("transferred"), {
  intervalDays: 60,
  reason: "longer maintenance interval after transfer evidence"
});

console.log("progression-retention tests: OK");
