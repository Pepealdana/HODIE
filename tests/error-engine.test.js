import assert from "node:assert/strict";
import { createError, prioritizeErrors, shouldRetry, evaluateCriteria, buildFeedback } from "../src/error-engine.js";

const activity = { id: "TEST-01", skill: "grammar", context: "professional" };

const errors = [
  createError({ activity, type: "grammar", target: "be", priority: "high", severity: "high", message: "Use am with I." }),
  createError({ activity, type: "vocabulary", target: "teacher", priority: "low", severity: "low", message: "Check this word." })
];

assert.equal(prioritizeErrors(errors, 1)[0].target, "be");
assert.equal(shouldRetry(errors), true);

const criteria = evaluateCriteria([
  { id: "profession", label: "Say your profession.", patterns: ["\\b(i am|i'm)\\s+(a|an)\\s+\\w+\\b"] }
], "I am a teacher.");
assert.equal(criteria[0].matched, true);

const feedback = buildFeedback(
  activity,
  { correct: false, score: 0, feedback: "Try again.", feedbackEs: "Inténtalo de nuevo." },
  errors,
  { maxPriorityCorrections: 1 }
);
assert.equal(feedback.success, false);
assert.equal(feedback.corrections.length, 1);
assert.equal(feedback.corrections[0].target, "be");

console.log("HODIE Error & Feedback Engine: PASS");
