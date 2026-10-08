import assert from "node:assert/strict";
import fs from "node:fs";
import { evaluateMicroActivity, selectMicroActivities } from "../src/micro-practice.js";

const library = JSON.parse(
  fs.readFileSync(new URL("../data/micro-practice-library.json", import.meta.url), "utf8")
);

const mixed = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "mixed", limit: 6 });
assert.equal(mixed.at(-1).type, "mini-production");
assert.ok(mixed.some((item) => item.type === "listening"));
assert.ok(mixed.some((item) => item.type === "speak"));
assert.ok(mixed.some((item) => item.resources?.includes("grammar")));
assert.ok(mixed.some((item) => item.resources?.includes("vocabulary")));

const grammar = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "grammar", limit: 4 });
assert.ok(grammar.length >= 3);
assert.ok(grammar.every((item) => item.resources?.includes("grammar")));
assert.ok(grammar.every((item) => ["choose", "complete", "order", "match"].includes(item.type)));
assert.ok(grammar.every((item) => item.type !== "mini-production"));

const vocabulary = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "vocabulary", limit: 4 });
assert.ok(vocabulary.length >= 2);
assert.ok(vocabulary.every((item) => item.resources?.includes("vocabulary")));
assert.ok(vocabulary.every((item) => ["choose", "complete", "order", "match"].includes(item.type)));
assert.ok(vocabulary.every((item) => item.type !== "mini-production"));

const listening = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "listening", limit: 4 });
assert.equal(listening.length, 3);
assert.ok(listening.every((item) => item.type === "listening"));
assert.ok(listening.every((item) => item.skill === "listening"));

const speaking = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "speaking", limit: 4 });
assert.equal(speaking.length, 2);
assert.ok(speaking.every((item) => item.type === "speak"));

const writing = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "writing", limit: 4 });
assert.equal(writing.length, 1);
assert.equal(writing[0].type, "mini-production");
assert.equal(writing[0].skill, "writing");
assert.ok(writing[0].evaluation?.criteria?.length >= 3);

const speakActivity = library.activities.find((item) => item.type === "speak");
assert.equal(speakActivity.audioText, speakActivity.targetPhrase);
assert.equal(speakActivity.audio?.language, "en-US");
assert.ok(speakActivity.audio?.slowRate < speakActivity.audio?.normalRate);

const correct = evaluateMicroActivity(library.activities[0], "am");
assert.equal(correct.correct, true);
assert.equal(correct.score, 1);

const wrong = evaluateMicroActivity(library.activities[0], "is");
assert.equal(wrong.correct, false);
assert.equal(wrong.retryRecommended, true);

const production = library.activities.find((item) => item.type === "mini-production");
const short = evaluateMicroActivity(production, "I am a teacher.");
assert.equal(short.correct, false);
assert.ok(short.errors.length >= 1);
const enough = evaluateMicroActivity(
  production,
  "I am a technology teacher. I work with students and I enjoy programming."
);
assert.equal(enough.correct, true);
assert.equal(enough.errors.length, 0);

const nonsense = evaluateMicroActivity(production, "this is my app english");
assert.equal(nonsense.correct, false);
assert.ok(nonsense.errors.some((error) => error.target === "profession"));

console.log("HODIE Micro Practice Engine: PASS");


const grammarActivities = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "grammar", limit: 6 });
assert.ok(grammarActivities.length >= 6);

const writingActivity = library.activities.find((item) => item.skill === "writing" && item.type === "mini-production");
const writingErrors = evaluateMicroActivity(
  writingActivity,
  "I am teacher. I work with students. I enjoy to read books. My students is very important."
);
assert.equal(writingErrors.correct, true);
assert.ok(writingErrors.errors.some((error) => error.target === "article"));
const workPlaceErrors = evaluateMicroActivity(
  writingActivity,
  "I am a teacher. I work on a school and I enjoy reading."
);
assert.ok(workPlaceErrors.errors.some((error) => error.target === "work-place"));
assert.ok(writingErrors.errors.some((error) => error.target === "enjoy-ing"));
assert.ok(writingErrors.corrections.length >= 1);
assert.equal(writingErrors.retryRecommended, false);

const speakingActivities = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "speaking", limit: 6 });
assert.ok(speakingActivities.length >= 2);
assert.ok(speakingActivities.every((item) => item.type === "speak"));
