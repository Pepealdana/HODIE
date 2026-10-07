import assert from "node:assert/strict";
import fs from "node:fs";
import { createSession } from "../src/learning-session.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

const profile = {
  evidence: [],
  reviews: []
};

const session = createSession(matrix, library, profile, {
  now: "2026-10-07T12:00:00.000Z",
  contextTerms: ["technology", "teacher", "work"]
});

assert.equal(session.target.canDoId, "SP-A2-01");
assert.equal(session.target.skill, "speaking");
assert.ok(session.durationMinutes > 0);
assert.ok(session.stages.length >= 1);
assert.equal(session.completion.evidenceRequired, true);
assert.equal(session.completion.progressMutation, "register-evidence");

console.log("HODIE Learning Session v1: PASS");
