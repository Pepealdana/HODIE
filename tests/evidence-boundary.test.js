import assert from "node:assert/strict";
import fs from "node:fs";
import { createSessionForCanDo } from "../src/learning-session.js";
import { startSession, requestEvidence } from "../src/session-state.js";
import { submitSessionEvidence } from "../src/evidence-boundary.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");
const profile = { evidence: [], reviews: [] };

let session = createSessionForCanDo(matrix, library, profile, "SP-A2-02", {
  sessionId: "session-boundary-1",
  now: "2026-10-07T12:00:00.000Z"
});

session = startSession(session);
session = requestEvidence(session);

const rawEvidence = {
  sessionId: session.id,
  activityId: "ACT-SP-A2-02-01",
  canDoId: "SP-A2-02",
  contextId: "family-1",
  timestamp: "2026-10-07T12:00:00.000Z",
  independent: false,
  confidence: 2,
  dimensions: {
    taskCompletion: 0.5,
    grammar: 0.4,
    fluency: 0.6
  },
  errors: [
    {
      priority: "high",
      type: "grammar",
      target: "be",
      message: "Needs support with be."
    }
  ]
};

const submitted = submitSessionEvidence(
  matrix,
  library,
  session,
  profile,
  rawEvidence,
  { now: "2026-10-07T12:00:00.000Z" }
);

assert.equal(submitted.evidence.sessionId, session.id);
assert.equal(submitted.evidence.activityId, "ACT-SP-A2-02-01");
assert.equal(submitted.profile.evidence.length, 1);
assert.equal(submitted.nextReviewAt, "2026-10-08T12:00:00.000Z");
assert.equal(session.evidenceContract.assessmentActivityId, "ACT-SP-A2-02-01");

assert.throws(
  () =>
    submitSessionEvidence(
      matrix,
      library,
      session,
      profile,
      { ...rawEvidence, activityId: "ACT-SP-A2-01-01" },
      { now: "2026-10-07T12:00:00.000Z" }
    ),
  /does not belong to the learning session/
);

const recoverySession = createSessionForCanDo(matrix, library, profile, "SP-A2-02", {
  sessionId: "session-boundary-recovery",
  now: "2026-10-07T12:00:00.000Z",
  gap: { type: "grammar", target: "be" },
  retryRequired: true
});
const recoveryActivityId = recoverySession.stages.find((stage) => stage.kind === "recovery")?.activity.id;

if (recoveryActivityId) {
  const recoveryEvidence = { ...rawEvidence, sessionId: recoverySession.id, activityId: recoveryActivityId };
  const activeRecoverySession = requestEvidence(startSession(recoverySession));

  assert.throws(
    () =>
      submitSessionEvidence(
        matrix,
        library,
        activeRecoverySession,
        profile,
        recoveryEvidence,
        { now: "2026-10-07T12:00:00.000Z" }
      ),
    /must be the session assessment activity/
  );
}

assert.throws(
  () =>
    submitSessionEvidence(
      matrix,
      library,
      session,
      profile,
      { ...rawEvidence, canDoId: "SP-A2-01" },
      { now: "2026-10-07T12:00:00.000Z" }
    ),
  /does not match the session target/
);

assert.throws(
  () =>
    submitSessionEvidence(
      matrix,
      library,
      session,
      profile,
      { ...rawEvidence, confidence: 6 },
      { now: "2026-10-07T12:00:00.000Z" }
    ),
  /confidence must be an integer from 1 to 5/
);

console.log("HODIE Evidence Boundary v1: PASS");
