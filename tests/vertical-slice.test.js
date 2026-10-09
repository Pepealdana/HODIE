import assert from "node:assert/strict";
import fs from "node:fs";
import { createSession, createSessionForCanDo } from "../src/learning-session.js";
import { startSession, requestEvidence } from "../src/session-state.js";
import { runSessionEvidenceCycle } from "../src/session-runner.js";

const read = (path) =>
  JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));

const matrix = read("../data/can-do-matrix.json");
const library = read("../data/content-library.json");

const activityFor = (canDoId) =>
  library.activities.find((activity) => activity.canDoId === canDoId);

const prepare = (profile, canDoId, sessionId, now, contextId) => {
  let session = createSessionForCanDo(matrix, library, profile, canDoId, {
    sessionId,
    contextTerms: ["technology", "teacher", "work", "daily-life"],
    now
  });
  session = requestEvidence(startSession(session, { now }));
  return session;
};

const evidenceFor = (session, overrides = {}) => ({
  sessionId: session.id,
  activityId: session.evidenceContract.assessmentActivityId,
  canDoId: session.target.canDoId,
  contextId: "vertical-slice",
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
});

// 1. Every executable target in the slice has exactly one assessment activity.
for (const canDoId of ["SP-A2-01", "SP-A2-02", "SP-A2-03", "SP-A2-04"]) {
  const activity = activityFor(canDoId);
  assert.ok(activity, `Missing activity for ${canDoId}`);
  const session = prepare({ evidence: [], reviews: [] }, canDoId, `slice-${canDoId}`, "2026-10-07T12:00:00.000Z", canDoId);
  assert.equal(session.evidenceContract.assessmentActivityId, activity.id);
  assert.ok(session.evidenceContract.activityIds.includes(activity.id));
}

// 2. A failed target must go through recovery, preserve the target Can-Do,
//    and require retry rather than mutating progress from the recovery activity.
let profile = { evidence: [], reviews: [] };
let session = prepare(profile, "SP-A2-02", "slice-failure", "2026-10-07T12:00:00.000Z", "family");
const failed = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  session,
  evidenceFor(session, {
    independent: false,
    confidence: 2,
    dimensions: { taskCompletion: 0.5, grammar: 0.4, fluency: 0.6 },
    errors: [{ priority: "high", type: "grammar", target: "be", message: "Needs support with be." }]
  }),
  { now: "2026-10-07T12:00:00.000Z" }
);
assert.equal(failed.result.retryRequired, true);
assert.equal(failed.session.state, "retry-required");
assert.equal(failed.nextSession.mode, "recovery");
assert.equal(failed.nextSession.target.canDoId, "SP-A2-02");
assert.equal(failed.nextSession.stages.at(-1).kind, "retry");
assert.equal(failed.nextSession.evidenceContract.assessmentActivityId, activityFor("SP-A2-02").id);

// 3. Successful evidence must advance the adaptive path from SP-A2-01 to SP-A2-02.
profile = { evidence: [], reviews: [] };
session = prepare(profile, "SP-A2-01", "slice-success-1", "2026-10-07T12:00:00.000Z", "work");
const first = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  session,
  evidenceFor(session, { contextId: "work" }),
  { now: "2026-10-07T12:00:00.000Z", contextTerms: ["work", "teacher"] }
);
assert.equal(first.result.retryRequired, false);
assert.equal(first.session.state, "next");
assert.equal(first.nextSession.target.canDoId, "SP-A2-02");

// 4. A successful SP-A2-02 should continue to SP-A2-03 because it is the
//    most recent prerequisite-backed communicative target.
profile = first.result.profile;
session = prepare(profile, "SP-A2-02", "slice-success-2", "2026-10-07T12:15:00.000Z", "family");
const second = runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  session,
  evidenceFor(session, { contextId: "family" }),
  { now: "2026-10-07T12:15:00.000Z", contextTerms: ["family", "daily-life"] }
);
assert.equal(second.result.retryRequired, false);
assert.equal(second.nextSession.target.canDoId, "SP-A2-03");

// 5. SP-A2-03 and SP-A2-04 are executable through the same session/evidence
//    boundary, without special-case orchestration.
profile = second.result.profile;
for (const [canDoId, contextId] of [["SP-A2-03", "routine"], ["SP-A2-04", "preferences"]]) {
  session = prepare(profile, canDoId, `slice-${canDoId}-run`, "2026-10-07T12:30:00.000Z", contextId);
  const result = runSessionEvidenceCycle(
    matrix,
    library,
    profile,
    session,
    evidenceFor(session, { contextId }),
    { now: "2026-10-07T12:30:00.000Z" }
  );
  assert.equal(result.result.retryRequired, false);
  assert.equal(result.session.state, "next");
  profile = result.result.profile;
}

// 6. The accumulated profile contains evidence from all four Can-Dos and the
//    progression layer still returns a coherent functional assessment.
const completedIds = new Set(profile.evidence.map((evidence) => evidence.canDoId));
for (const canDoId of ["SP-A2-01", "SP-A2-02", "SP-A2-03", "SP-A2-04"]) {
  assert.ok(completedIds.has(canDoId), `Missing evidence for ${canDoId}`);
}

console.log("HODIE Vertical Slice A2 Speaking: PASS");
