import assert from "node:assert/strict";
import { createLearningOpportunity, evaluateLearningOpportunity, recordLearningOpportunity, summarizeLearningOpportunities } from "../src/learning-opportunity.js";

const did = createLearningOpportunity("LING-DID-NEG-BASE-001");
assert.ok(did, "a detected past-negation rule should offer a follow-up exercise");
assert.equal(evaluateLearningOpportunity(did, "build").correct, true);
assert.equal(evaluateLearningOpportunity(did, "built").correct, false);
assert.equal(createLearningOpportunity("UNKNOWN-RULE"), null, "unknown rules must not receive an invented exercise");

let profile = {};
profile = recordLearningOpportunity(profile, { ruleId: did.ruleId, activityId: "conversation-1", answer: "built", expected: "build", correct: false, attempt: 1 });
profile = recordLearningOpportunity(profile, { ruleId: did.ruleId, activityId: "conversation-1", answer: "build", expected: "build", correct: true, attempt: 2 });
const summary = summarizeLearningOpportunities(profile);
assert.equal(summary.attempts, 2);
assert.equal(summary.correct, 1);
assert.equal(summary.accuracy, 0.5);
assert.equal(summary.rules[0].firstTryCorrect, 0, "a later retry must not count as first-try mastery");

profile = recordLearningOpportunity(profile, { ruleId: did.ruleId, activityId: "conversation-2", answer: "build", expected: "build", correct: true, attempt: 1 });
assert.equal(summarizeLearningOpportunities(profile).rules[0].firstTryCorrect, 1);
console.log("HODIE learning opportunity loop: PASS");
