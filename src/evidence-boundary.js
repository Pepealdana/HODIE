import { registerEvidence } from "./learning-engine.js";

function getActivity(library, activityId) {
  return (library.activities || []).find((activity) => activity.id === activityId) || null;
}

function requireField(condition, message) {
  if (!condition) throw new Error(message);
}

function validateEvidencePayload(rawEvidence = {}) {
  requireField(typeof rawEvidence.canDoId === "string" && rawEvidence.canDoId, "Evidence must include canDoId.");
  requireField(typeof rawEvidence.sessionId === "string" && rawEvidence.sessionId, "Evidence must include sessionId.");
  requireField(typeof rawEvidence.activityId === "string" && rawEvidence.activityId, "Evidence must include activityId.");
  requireField(typeof rawEvidence.contextId === "string" && rawEvidence.contextId, "Evidence must include contextId.");
  requireField(typeof rawEvidence.timestamp === "string" && rawEvidence.timestamp, "Evidence must include timestamp.");
  requireField(typeof rawEvidence.independent === "boolean", "Evidence must include independent as a boolean.");
  requireField(Number.isInteger(rawEvidence.confidence) && rawEvidence.confidence >= 1 && rawEvidence.confidence <= 5, "Evidence confidence must be an integer from 1 to 5.");
  requireField(rawEvidence.dimensions && typeof rawEvidence.dimensions === "object" && !Array.isArray(rawEvidence.dimensions), "Evidence must include dimensions.");
  requireField(Array.isArray(rawEvidence.errors), "Evidence must include errors as an array.");
}

function validateSessionEvidence(matrix, library, session, rawEvidence) {
  requireField(session?.id, "A valid learning session is required.");
  requireField(session.state === "awaiting-evidence" || session.state === "completed", "Evidence can only be submitted for an active session awaiting or completing evidence.");

  validateEvidencePayload(rawEvidence);

  requireField(rawEvidence.sessionId === session.id, "Evidence sessionId does not match the learning session.");
  requireField(rawEvidence.canDoId === session.target?.canDoId, "Evidence canDoId does not match the session target.");

  const allowedActivityIds = session.evidenceContract?.activityIds || [];
  requireField(allowedActivityIds.includes(rawEvidence.activityId), "Evidence activityId does not belong to the learning session.");

  const activity = getActivity(library, rawEvidence.activityId);
  requireField(activity, `Unknown activity: ${rawEvidence.activityId}`);
  requireField(activity.canDoId === session.target.canDoId, "Evidence activity does not belong to the session Can-Do.");

  const canDo = (matrix.canDos || []).find((item) => item.id === rawEvidence.canDoId);
  requireField(canDo, `Unknown Can-Do: ${rawEvidence.canDoId}`);

  return { activity, canDo };
}

function submitSessionEvidence(matrix, library, session, rawEvidence, options = {}) {
  validateSessionEvidence(matrix, library, session, rawEvidence);
  const result = registerEvidence(matrix, { evidence: [], reviews: [], ...(options.profile || {}) }, rawEvidence, options);
  return {
    ...result,
    evidence: result.profile.evidence[result.profile.evidence.length - 1]
  };
}

export {
  validateEvidencePayload,
  validateSessionEvidence,
  submitSessionEvidence
};
