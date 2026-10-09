import assert from "node:assert/strict";
import fs from "node:fs";
import { chooseLearningSurface, countRecentErrors } from "../src/learning-orchestrator.js";

const matrix = JSON.parse(fs.readFileSync(new URL("../data/can-do-matrix.json", import.meta.url), "utf8"));
const experiences = JSON.parse(fs.readFileSync(new URL("../data/experience-library.json", import.meta.url), "utf8"));

const empty = { evidence: [], reviews: [] };
assert.equal(countRecentErrors(empty), 0);

const first = chooseLearningSurface(matrix, experiences, empty, {
  level: "A2",
  context: "professional",
  now: "2026-10-08T00:00:00.000Z"
});
assert.equal(first.surface, "conversation");
assert.equal(first.experienceId, "EXP-CONV-FREE-A2-01");

const gapProfile = {
  evidence: [
    { errors: [{ type: "grammar" }, { type: "grammar" }] }
  ],
  reviews: []
};
const review = chooseLearningSurface(matrix, experiences, gapProfile, {
  level: "A2",
  context: "professional",
  now: "2026-10-08T00:00:00.000Z"
});
assert.equal(review.surface, "practice");
assert.equal(review.mode, "review");

console.log("HODIE Learning Orchestrator v1: PASS");
