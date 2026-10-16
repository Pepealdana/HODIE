import assert from "node:assert/strict";
import fs from "node:fs";
import { getB2UnlockStatus } from "../src/level-unlock.js";

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url), "utf8"));
const policy = JSON.parse(fs.readFileSync(new URL("../data/b2-unlock-policy.json", import.meta.url), "utf8"));
const empty = getB2UnlockStatus(matrix, { evidence: [] }, policy);
assert.equal(empty.unlocked, false);
assert.equal(empty.unmet.length, policy.requirements.length);

const profile = { evidence: [] };
for (const requirement of policy.requirements) {
  const goals = matrix.canDos.filter((item) => item.level === "B1" && item.skill === requirement.skill);
  assert.ok(goals.length >= requirement.minimumFunctional, requirement.skill + " must have enough B1 Can-Dos");
  const consolidatedCount = Math.min(requirement.minimumConsolidated, goals.length);
  goals.slice(0, consolidatedCount).forEach((goal, index) => {
    for (const contextId of ["personal", "professional"]) {
      profile.evidence.push({
        canDoId: goal.id, independent: true, confidence: 4, contextId,
        level: "independent", dimensions: { taskCompletion: 0.9, accuracy: 0.9 },
        timestamp: `2026-10-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`
      });
    }
  });
  goals.slice(consolidatedCount, requirement.minimumFunctional).forEach((goal) => {
    profile.evidence.push({
      canDoId: goal.id, independent: true, confidence: 4, contextId: "personal",
      level: "independent", dimensions: { taskCompletion: 0.9, accuracy: 0.9 },
      timestamp: "2026-10-15T12:00:00.000Z"
    });
  });
}
const ready = getB2UnlockStatus(matrix, profile, policy);
assert.equal(ready.unlocked, true, JSON.stringify(ready.unmet));
assert.equal(ready.certification, false);

const singleContext = { evidence: profile.evidence.filter((item) => item.contextId === "personal") };
assert.equal(getB2UnlockStatus(matrix, singleContext, policy).unlocked, false,
  "One context must not count as consolidated mastery.");

console.log("HODIE B2 evidence gate: PASS");
