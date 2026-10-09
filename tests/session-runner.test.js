import assert from "node:assert/strict";
import fs from "node:fs";
import { createSessionForCanDo } from "../src/learning-session.js";
import { startSession, requestEvidence } from "../src/session-state.js";
import { runSessionEvidenceCycle } from "../src/session-runner.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

function prepareSession(profile, canDoId, sessionId, context = "work") {
  let session = createSessionForCanDo(matrix, library, profile, canDoId, {
    sessionId,
    contextTerms: ["technology", "teacher", "work"],
    now: "2026-10-07T12:00:00.000Z"
  });
  session = requestEvidence(startSession(session));
  return { session, context };
}

function evidenceFor(session, overrides = {}) {
  return {
    sessionId: session.id,
    activityId: session.evidenceContract.activityIds[0],
    canDoId: session.target.canDoId,
    contextId: "work",
    timestamp: "2026-10-07T12:00:00.000Z",
    independent: true,
    confidence: 4,
    dimensions: {
      taskCompletion: 1,
      grammar: 0.9,
      fluency: 0.9,
      vocabulary: 0.9,
      pronunciation: 0.9
    },
    errors: [],
    ...overrides
  };
}

// A. Successful session closes and advances.
let profile = { evidence: [], reviews: [] };
let prepared = prepareSession(profile, "SP-A2-01", "e2e-success");
let successful = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session),
  { now: "2026-10-07T12:00:00.000Z", contextTerms: ["technology", "teacher", "work"] }
);

assert.equal(successful.session.state, "next");
assert.equal(successful.result.retryRequired, false);
assert.ok(successful.nextSession.target.canDoId);
assert.equal(successful.result.profile.evidence.length, 1);

// B. Failed evidence routes to recovery and retry.
profile = { evidence: [], reviews: [] };
prepared = prepareSession(profile, "SP-A2-02", "e2e-failure");
const failed = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session, {
    independent: false,
    confidence: 2,
    contextId: "family-1",
    dimensions: { taskCompletion: 0.5, grammar: 0.4, fluency: 0.6 },
    errors: [{
      priority: "high",
      type: "grammar",
      target: "be",
      message: "Needs support with be."
    }]
  }),
  { now: "2026-10-07T12:00:00.000Z" }
);

assert.equal(failed.session.state, "retry-required");
assert.equal(failed.result.retryRequired, true);
assert.equal(failed.nextSession.mode, "recovery");
assert.equal(failed.nextSession.target.canDoId, "SP-A2-02");
assert.equal(failed.nextSession.stages.at(-1).kind, "retry");

// C. A successful performance with a minor weakness does not force retry.
profile = { evidence: [], reviews: [] };
prepared = prepareSession(profile, "SP-A2-01", "e2e-minor-gap");
const minorGap = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session, {
    dimensions: { taskCompletion: 1, grammar: 1, fluency: 1, vocabulary: 0.6, pronunciation: 1 }
  }),
  { now: "2026-10-07T12:00:00.000Z" }
);

assert.equal(minorGap.result.retryRequired, false);
assert.equal(minorGap.session.state, "next");

// D. Session/activity integrity is enforced.
assert.throws(
  () =>
    runSessionEvidenceCycle(
      matrix,
      library,
      { evidence: [], reviews: [] },
      prepared.session,
      evidenceFor(prepared.session, { activityId: "ACT-SP-A2-02-01" }),
      { now: "2026-10-07T12:00:00.000Z" }
    ),
  /does not belong to the learning session/
);

// E. Two independent successes in different contexts consolidate the Can-Do.
profile = { evidence: [], reviews: [] };
prepared = prepareSession(profile, "SP-A2-01", "e2e-master-1");
let firstMastery = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session, { contextId: "work" }),
  { now: "2026-10-07T12:00:00.000Z" }
);
profile = firstMastery.result.profile;

prepared = prepareSession(profile, "SP-A2-01", "e2e-master-2");
let secondMastery = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session, { contextId: "school" }),
  { now: "2026-10-08T12:00:00.000Z" }
);

assert.equal(secondMastery.result.canDo.status, "consolidated");

// F. A successful independent transfer changes the status to transferred.
profile = secondMastery.result.profile;
prepared = prepareSession(profile, "SP-A2-01", "e2e-transfer");
const transfer = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  prepared.session,
  evidenceFor(prepared.session, {
    contextId: "conference",
    transfer: true
  }),
  { now: "2026-10-09T12:00:00.000Z" }
);

assert.equal(transfer.result.canDo.status, "transferred");

console.log("HODIE End-to-End Learning Scenarios v1: PASS");
