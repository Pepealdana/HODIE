import assert from "node:assert/strict";
import fs from "node:fs";
import { composeLearningSession } from "../src/session-composer.js";

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const matrix = read("../data/can-do-matrix.json");
const microLibrary = read("../data/micro-practice-library.json");
const experienceLibrary = read("../data/experience-library.json");

const session = composeLearningSession({
  matrix,
  microLibrary,
  experienceLibrary,
  profile: { evidence: [] },
  mode: "standard",
  canDoId: "SP-A2-01",
  context: "professional"
});

assert.equal(session.mode, "standard");
assert.equal(session.budget.minutes, 15);
assert.ok(session.practice.length > 0);
assert.equal(session.evidenceBoundary, "Only explicit assessment activities can mutate progress.");

console.log("HODIE session composer: PASS");
