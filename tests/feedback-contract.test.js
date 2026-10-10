import assert from "node:assert/strict";
import fs from "node:fs";
import { createFeedbackContract } from "../src/feedback-contract.js";
import { evaluateExperienceTurn } from "../src/experience-engine.js";
import { getIntegratedUnit, evaluateIntegratedStep } from "../src/integrated-unit.js";
import { evaluateMicroActivity } from "../src/micro-practice.js";

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const experiences = read("../data/experience-library.json");
const microLibrary = read("../data/micro-practice-library.json");
const units = read("../data/integrated-units.json");

// Real case 1: the user's conversation answer from the browser screenshot.
// This confirms the shared contract carries a detected compound-job connector correction
// from the deterministic conversation evaluator into the normalized feedback shape.
const conversation = experiences.experiences.find((item) => item.id === "EXP-CONV-FREE-A2-01");
const conversationResult = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I am a technology an robotics teacher. I work at a school."
);
const conversationFeedback = createFeedbackContract({
  activity: { id: conversation.id, skill: "speaking" },
  surface: "conversation",
  response: "I am a technology an robotics teacher. I work at a school.",
  result: conversationResult
});
assert.equal(conversationFeedback.contractVersion, "1.0.0");
assert.equal(conversationFeedback.surface, "conversation");
assert.equal(conversationFeedback.status, "partial");
assert.equal(conversationFeedback.metrics.wordCount, 12);
assert.equal(conversationFeedback.metrics.sentenceCount, 2);
assert.ok(conversationFeedback.corrections.some((item) => item.target === "compound-job-connector"));
assert.ok(conversationFeedback.nextAction.instruction);

// Real case 2: known rule-based grammar error in conversation.
const grammarResult = evaluateExperienceTurn(conversation, conversation.stages[1], "I enjoy to work with students.");
const grammarFeedback = createFeedbackContract({
  activity: { id: conversation.id, skill: "speaking" },
  surface: "conversation",
  response: "I enjoy to work with students.",
  result: grammarResult
});
assert.ok(grammarFeedback.corrections.some((item) => item.target === "enjoy-ing"));
assert.equal(grammarFeedback.nextAction.kind, "retry-correction");

// Real case 3: integrated-unit open production is a guided checklist, not an objective grade.
const unit = getIntegratedUnit(units, "UNIT-A2-ROBOTICS-01");
const writingStep = unit.steps.find((step) => step.kind === "write");
const writingResponse = "the students builds a robot";
const writingResult = evaluateIntegratedStep(writingStep, writingResponse);
const writingFeedback = createFeedbackContract({
  activity: { id: writingStep.id, skill: "writing" },
  surface: "writing",
  response: writingResponse,
  result: writingResult,
  source: "checklist"
});
assert.equal(writingFeedback.status, "self-review");
assert.ok(writingFeedback.missing.some((item) => item.id === "plural-subject" || item.id === "subject-verb-agreement"));
assert.ok(writingFeedback.limits.length > 0);

// Real case 4: a deterministic listening multiple-choice activity uses answer-key feedback.
const listeningActivity = microLibrary.activities.find((item) => item.type === "listening");
assert.ok(listeningActivity, "A listening activity must exist in the library.");
const listeningResult = evaluateMicroActivity(listeningActivity, "__deliberately_wrong_answer__");
const listeningFeedback = createFeedbackContract({
  activity: listeningActivity,
  surface: "listening",
  skill: "listening",
  response: "__deliberately_wrong_answer__",
  result: listeningResult,
  source: "answer-key"
});
assert.equal(listeningFeedback.status, "needs-work");
assert.ok(listeningFeedback.corrections.length > 0);
assert.equal(listeningFeedback.nextAction.kind, "retry-correction");

// Empty response must never be interpreted as a successful attempt.
const empty = createFeedbackContract({ activity: { id: "empty-case" }, response: "  ", result: { correct: true } });
assert.equal(empty.status, "empty");
assert.equal(empty.responseProvided, false);
assert.equal(empty.nextAction.kind, "respond");

// Ambiguous/open answer without objective correctness stays partial and receives no invented correction.
const ambiguous = createFeedbackContract({
  activity: { id: "ambiguous-writing", type: "mini-production", skill: "writing" },
  surface: "writing",
  response: "Robots are useful in school.",
  result: { correct: null, score: 0.8, checks: [{ id: "example", passed: true }] },
  source: "checklist"
});
assert.equal(ambiguous.status, "self-review");
assert.equal(ambiguous.corrections.length, 0);
assert.equal(ambiguous.nextAction.kind, "self-review");

// A clean sentence should not be assigned a grammar correction by the shared layer.
const clean = createFeedbackContract({
  activity: { id: "clean-speaking", skill: "speaking" },
  surface: "speaking",
  response: "I am a teacher and I enjoy building robots.",
  result: { strengths: [{ id: "connector", label: "Connected ideas" }] },
  source: "rule-based"
});
assert.equal(clean.status, "partial");
assert.equal(clean.corrections.length, 0);
assert.equal(clean.strengths.length, 1);

console.log("HODIE shared feedback contract: PASS");
