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
assert.equal(grammar.at(-1).type, "mini-production");
assert.ok(grammar.slice(0, -1).every((item) => item.skill === "grammar"));

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
