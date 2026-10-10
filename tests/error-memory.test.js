import assert from "node:assert/strict";
import { collectErrorMemory, getTopErrors, isRepeatedError } from "../src/error-memory.js";

const profile = {
  evidence: [{
    activityId: "session-assessment-1",
    contextId: "robotics",
    timestamp: "2026-10-08T10:00:00.000Z",
    errors: [{ type: "grammar", target: "article", actual: "I am teacher", expected: "I am a teacher" }]
  }],
  knowledgeEvidence: [
    {
      activityId: "writing-1",
      skill: "writing",
      at: "2026-10-08T10:05:00.000Z",
      errors: [{ type: "grammar", target: "article", actual: "I am teacher", expected: "I am a teacher" }]
    },
    {
      activityId: "listening-1",
      skill: "listening",
      at: "2026-10-08T10:06:00.000Z",
      errors: [{ type: "listening-comprehension", target: "main-idea", actual: "wrong option" }]
    },
    {
      activityId: "conversation-2",
      skill: "speaking",
      at: "2026-10-08T10:07:00.000Z",
      errors: [
        { type: "grammar", target: "article", actual: "I am teacher", expected: "I am a teacher" },
        { type: "grammar", target: "article", actual: "I am teacher", expected: "I am a teacher" }
      ]
    }
  ]
};

const memory = collectErrorMemory(profile);
const article = memory.find((item) => item.type === "grammar" && item.target === "article");
const listening = memory.find((item) => item.type === "listening-comprehension");
assert.equal(article.count, 3, "same target across surfaces must be grouped, duplicate within one attempt counted once");
assert.equal(listening.count, 1);
assert.equal(article.lastSeen, "2026-10-08T10:07:00.000Z");
assert.ok(isRepeatedError(profile, "grammar", "article", 2));
assert.equal(getTopErrors(profile, 1)[0].target, "article");
assert.ok(article.contexts.includes("robotics"));
assert.ok(article.contexts.includes("writing-1"));
assert.ok(article.contexts.includes("conversation-2"));
console.log("HODIE shared error memory: PASS");
