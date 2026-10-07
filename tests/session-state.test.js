import assert from "node:assert/strict";
import {
  startSession,
  requestEvidence,
  completeSession,
  markRetryRequired,
  startSession as restartSession,
  markNext
} from "../src/session-state.js";

const base = { id: "session-test", state: "planned" };

const started = startSession(base);
assert.equal(started.state, "started");
const awaiting = requestEvidence(started);
assert.equal(awaiting.state, "awaiting-evidence");
const completed = completeSession(awaiting);
assert.equal(completed.state, "completed");
const retry = markRetryRequired(completed);
assert.equal(retry.state, "retry-required");
const restarted = restartSession(retry);
assert.equal(restarted.state, "started");

const next = markNext(completed);
assert.equal(next.state, "next");
assert.throws(() => markNext(base), /Invalid session transition/);
assert.equal(base.state, "planned");

console.log("HODIE Session State v1: PASS");
