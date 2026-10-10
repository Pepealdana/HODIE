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
assert.ok(first.strengths.some((item) => item.id === "work"));
assert.ok(first.nextStep?.instruction);

const spellingAndArticle = evaluateExperienceTurn(conversation, conversation.stages[0], "i am techer");
assert.equal(spellingAndArticle.correctedText, "I am a teacher");
assert.ok(spellingAndArticle.corrections.some((error) => error.target === "spelling-teacher"));
assert.ok(spellingAndArticle.corrections.some((error) => error.target === "capital-i"));
assert.ok(spellingAndArticle.corrections.some((error) => error.target === "article-profession"));
const validJobTitle = evaluateExperienceTurn(conversation, conversation.stages[0], "I am a technology and robotics teacher.");
assert.equal(validJobTitle.correctedText, "I am a technology and robotics teacher.");
assert.equal(validJobTitle.corrections.length, 0);
assert.ok(first.wordCount > 0);
assert.ok(first.sentenceCount >= 1);
assert.ok(["language-note", "task-focus", "practice-guidance"].includes(first.feedbackStatus));

session = advanceExperienceSession(session, first);
assert.equal(session.index, 1);

const imperfect = evaluateExperienceTurn(
  conversation,
  conversation.stages[1],
  "I enjoy to work with students."
);
assert.equal(imperfect.canContinue, true);
assert.ok(imperfect.corrections.some((error) => error.target === "enjoy-gerund"));
session = advanceExperienceSession(session, imperfect);

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

const noGrammarIssue = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I am a technology teacher. I work at a school and I enjoy robotics."
);
assert.equal(noGrammarIssue.canContinue, true);
assert.equal(noGrammarIssue.corrections.length, 0);
assert.ok(noGrammarIssue.strengths.length > 0);
assert.ok(noGrammarIssue.nextStep.instruction);
assert.equal(noGrammarIssue.feedbackStatus, "practice-guidance");

// Regression cases: targeted A2 grammar patterns should be detected without flagging valid examples.
const articleConnector = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I am a technology an robotics teacher."
);

assert.ok(articleConnector.corrections.some((error) => error.target === "compound-job-connector"));

const copiedAnswer = evaluateExperienceTurn(
  conversation,
  conversation.stages[1],
  "I am a technology and robotics teacher. I work at a school."
);
assert.equal(copiedAnswer.missing.some((item) => item.id === "preference"), true);
assert.equal(copiedAnswer.strengths.some((item) => item.id === "preference"), false);

const incompleteEnjoy = evaluateExperienceTurn(conversation, conversation.stages[2], "I enjoy");
assert.equal(incompleteEnjoy.missing.some((item) => item.id === "challenge"), true);

const writingErrors = evaluateExperienceTurn(conversation, conversation.stages[0], "i am techer");
assert.ok(writingErrors.corrections.some((error) => error.target === "capital-i"));
assert.ok(writingErrors.corrections.some((error) => error.target === "spelling-teacher"));

const pluralAgreement = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "My students is very creative."
);
assert.ok(pluralAgreement.corrections.some((error) => error.target === "plural-agreement"));

const singularAgreement = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "The robot use a sensor."
);
assert.ok(singularAgreement.corrections.some((error) => error.target === "third-person-singular"));

const connectorFalsePositive = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I teach robotics and I enjoy building robots because my students like technology."
);
assert.equal(connectorFalsePositive.corrections.some((error) => error.target === "repeated-connector"), false);
assert.equal(connectorFalsePositive.corrections.some((error) => error.target === "plural-subject-agreement"), false);
assert.equal(connectorFalsePositive.corrections.some((error) => error.target === "singular-subject-agreement"), false);

const missingGoal = evaluateExperienceTurn(
  conversation,
  conversation.stages[0],
  "I like technology because it is interesting."
);
assert.equal(missingGoal.missing.length, 1);
assert.match(missingGoal.nextStep.instruction, /Mention your job|job|what you do/i);

const summaryWithNoCorrections = summarizeExperience(conversation, {
  ...session,
  corrections: [],
  responses: [noGrammarIssue]
});
assert.ok(summaryWithNoCorrections.strengths.length > 0);
assert.equal(summaryWithNoCorrections.practiceSteps.length, 1);
assert.ok(summaryWithNoCorrections.practiceSteps[0].instruction);

const empty = evaluateExperienceTurn(conversation, conversation.stages[0], " ");
assert.equal(empty.canContinue, false);
assert.equal(empty.feedbackStatus, "empty");
assert.equal(empty.nextStep, null);

console.log("HODIE Learning Experiences v1: PASS");
