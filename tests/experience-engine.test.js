import assert from "node:assert/strict";
import fs from "node:fs";
import {
  getExperience,
  validateExperience,
  selectExperiences,
  createExperienceSession,
  evaluateExperienceTurn,
  advanceExperienceSession,
  isExperienceComplete,
  summarizeExperience
} from "../src/experience-engine.js";

const library = JSON.parse(
  fs.readFileSync(new URL("../data/experience-library.json", import.meta.url), "utf8")
);

assert.equal(library.schemaVersion, "1.0.0");
assert.equal(library.experiences.length, 4);

const conversation = getExperience(library, "EXP-CONV-FREE-A2-01");
assert.ok(conversation);
assert.equal(validateExperience(conversation), true);
assert.equal(conversation.kind, "conversation");
assert.equal(conversation.mode, "guided-open");

const simulations = selectExperiences(library, { kind: "simulation" });
assert.equal(simulations.length, 3);
assert.ok(selectExperiences(library, { kind: "conversation" }).length >= 1);

let session = createExperienceSession(library, conversation.id, { now: "2026-10-08T00:00:00.000Z" });
assert.equal(session.index, 0);
assert.equal(session.state, "started");

const first = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I am a technology teacher and I work with students."
);
assert.equal(first.responseProvided, true);
assert.equal(first.canContinue, true);
assert.equal(first.matched.length, 1);

session = advanceExperienceSession(session, first);
assert.equal(session.index, 1);

const imperfect = evaluateExperienceTurn(
  conversation,
  conversation.stages[1],
  "I enjoy to work with students."
);
assert.equal(imperfect.canContinue, true);
assert.ok(imperfect.corrections.some((error) => error.target === "enjoy-ing"));

for (let i = 2; i < conversation.stages.length; i += 1) {
  const result = evaluateExperienceTurn(conversation, conversation.stages[i], [
    "One difficult thing is finding time.",
    "I would like to improve my English.",
    "How do you use technology?"
  ][i - 2]);
  session = advanceExperienceSession(session, result);
}

assert.equal(isExperienceComplete(conversation, session), true);
const summary = summarizeExperience(conversation, session);
assert.equal(summary.completed, true);
assert.equal(summary.turns, 5);
assert.ok(summary.corrections.length >= 1);

const empty = evaluateExperienceTurn(conversation, conversation.stages[0], " ");
assert.equal(empty.canContinue, false);

console.log("HODIE Learning Experiences v1: PASS");
