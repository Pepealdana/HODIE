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
assert.ok(speaking.length >= 2);
assert.ok(speaking.every((item) => ["speak", "mini-production"].includes(item.type)));

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

const writingTypo = evaluateMicroActivity(production, "i am techer");
assert.ok(writingTypo.errors.some((error) => error.target === "capital-i"));
assert.ok(writingTypo.errors.some((error) => error.target === "spelling-teacher"));
assert.ok(writingTypo.errors.some((error) => error.target === "article-profession"));
assert.match(writingTypo.errors.find((error) => error.correctedText)?.correctedText || "", /I am a teacher/i);
const nearSpeech = evaluateMicroActivity(speakActivity, "I am a technology and robotic teacher");
assert.equal(nearSpeech.correct, false);
assert.ok(nearSpeech.errors.some((error) => error.target === "speech-near-match"));
assert.ok(!nearSpeech.errors.some((error) => error.target === "required-information"));
const pluralError = evaluateMicroActivity(production, "I am a technology teacher. The students builds a robot and I enjoy programming.");
assert.ok(pluralError.errors.some((error) => error.target === "plural-agreement"));

// Every target exposed by the current A2 speaking vertical slice must have executable practice.
for (const [canDoId, productionResponse] of [
  ["SP-A2-01", "I am a technology teacher. I work with students and I enjoy programming."],
  ["SP-A2-02", "My family is small. I live with my parents and my sister."],
  ["SP-A2-03", "I get up at six. I have breakfast and I go to work in the morning."],
  ["SP-A2-04", "I like building robots, but I don't like getting up early because I am tired."]
]) {
  const targetActivities = library.activities.filter((item) => item.canDoId === canDoId);
  assert.ok(targetActivities.length >= 7, `Missing micro-practice coverage for ${canDoId}`);
  const targetMixed = selectMicroActivities(library, { canDoId, mode: "mixed", limit: 6 });
  assert.equal(targetMixed.length, 6, `Mixed practice should be available for ${canDoId}`);
  assert.equal(targetMixed.at(-1).type, "mini-production", `Production should finish mixed practice for ${canDoId}`);
  assert.ok(selectMicroActivities(library, { canDoId, mode: "listening", limit: 4 }).length >= 1);
  assert.ok(selectMicroActivities(library, { canDoId, mode: "speaking", limit: 4 }).length >= 1);
  assert.ok(selectMicroActivities(library, { canDoId, mode: "writing", limit: 4 }).length >= 1);
  const productionActivity = targetActivities.find((item) => item.type === "mini-production" && item.skill === "speaking");
  assert.ok(productionActivity, `Missing speaking production for ${canDoId}`);
  assert.equal(evaluateMicroActivity(productionActivity, productionResponse).correct, true, `Expected sample response to satisfy ${canDoId}`);
}


const spiralReview = selectMicroActivities(library, {
  canDoId: "RE-B1-01",
  mode: "review",
  limit: 6
});
assert.ok(spiralReview.length >= 3, "Review mode should build a useful cross-level retrieval set");
assert.ok(spiralReview.some((item) => item.level === "A1"),
  "Review mode must revisit foundational A1 activities even when the current target is B1");
assert.ok(spiralReview.some((item) => item.level === "A2" || item.level === "B1"),
  "Spiral review should mix foundational retrieval with current-level practice");

console.log("HODIE Micro Practice Engine: PASS");


const grammarActivities = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "grammar", limit: 6 });
assert.ok(grammarActivities.length >= 6);

const writingActivity = library.activities.find((item) => item.skill === "writing" && item.type === "mini-production");
const writingErrors = evaluateMicroActivity(
  writingActivity,
  "I am teacher. I work with students. I enjoy to read books. My students is very important."
);
assert.equal(writingErrors.correct, true);
assert.ok(writingErrors.errors.some((error) => error.target === "article-profession"));
const workPlaceErrors = evaluateMicroActivity(
  writingActivity,
  "I am a teacher. I work on a school and I enjoy reading."
);
assert.ok(workPlaceErrors.errors.some((error) => error.target === "work-place"));
assert.ok(writingErrors.errors.some((error) => error.target === "enjoy-gerund"));
assert.ok(writingErrors.corrections.length >= 1);
const typoWriting = evaluateMicroActivity(writingActivity, "i am tecaher");
assert.ok(typoWriting.errors.some((error) => error.target === "capital-i"));
assert.ok(typoWriting.errors.some((error) => error.target === "spelling-teacher"));
assert.ok(typoWriting.errors.some((error) => error.target === "article-profession"));
assert.match(typoWriting.errors.find((error) => error.correctedText)?.correctedText || "", /I am a teacher/i);
assert.equal(writingErrors.retryRecommended, false);

const speakingActivities = selectMicroActivities(library, { canDoId: "SP-A2-01", mode: "speaking", limit: 6 });
assert.ok(speakingActivities.length >= 2);
assert.ok(speakingActivities.every((item) => ["speak", "mini-production"].includes(item.type)));

for (const [mode, expectedSkill] of [
  ["reading", "reading"],
  ["pronunciation", "pronunciation"],
  ["communication", "communication"]
]) {
  const focused = selectMicroActivities(library, { mode, limit: 6 });
  assert.ok(focused.length >= 2, `Expected focused ${mode} activities to be available`);
  assert.ok(focused.every((item) => item.skill === expectedSkill), `${mode} mode must not substitute another skill`);
}

const reportedSpeech = library.activities.filter((item) => item.tags?.includes("reported-speech"));
assert.equal(reportedSpeech.length, 12);
for (const level of ["A1", "A2", "B1"]) assert.equal(reportedSpeech.filter((item) => item.level === level).length, 4, level + " Reported Speech coverage");
assert.ok(reportedSpeech.every((item) => item.prompt && item.promptEs && item.feedback.correct && item.feedback.correctEs));

const reportedSpeechB2Pack = JSON.parse(fs.readFileSync(new URL("../data/reported-speech-b2-pack.json", import.meta.url), "utf8"));
assert.equal(reportedSpeechB2Pack.activities.length, 4);
assert.ok(reportedSpeechB2Pack.activities.every((item) => item.level === "B2" && item.unlockRequirement === "B2"));
assert.equal(reportedSpeechB2Pack.visibility, "locked-until-evidence-gate");
