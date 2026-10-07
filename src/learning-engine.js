/**
 * HODIE Learning Engine v0.2
 * Deterministic, local-first adaptive learning engine.
 *
 * Flow:
 * Can-Do -> Evidence -> Gap -> Activity -> Feedback -> Retry -> Progress
 */

const STATUS_ORDER = ["notStarted", "emerging", "developing", "functional", "consolidated", "transferred"];
const EVIDENCE_ORDER = ["attempt", "supported", "independent", "consistent", "transfer"];

const DEFAULT_REVIEW_DAYS = [1, 2, 4, 7, 14, 30];

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function getCanDo(matrix, id) {
  return (matrix.canDos || []).find((item) => item.id === id) || null;
}

function normalizeEvidence(evidence = {}) {
  const dimensions = {};
  for (const [key, value] of Object.entries(evidence.dimensions || {})) {
    dimensions[key] = clamp(value);
  }

  return {
    canDoId: evidence.canDoId,
    level: evidence.level || "attempt",
    independent: Boolean(evidence.independent),
    contextId: evidence.contextId || "default",
    confidence: Number(evidence.confidence) || 0,
    dimensions,
    errors: Array.isArray(evidence.errors) ? evidence.errors : [],
    supportUsed: Array.isArray(evidence.supportUsed) ? evidence.supportUsed : [],
    timestamp: evidence.timestamp || new Date().toISOString()
  };
}

function average(values) {
  const valid = values.filter((v) => Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

function evidenceScore(evidence) {
  return average(Object.values(evidence.dimensions));
}

function determineEvidenceLevel(evidence) {
  const score = evidenceScore(evidence);

  if (evidence.independent && evidence.contextId !== "default" && score >= 0.75) {
    return "transfer";
  }
  if (evidence.independent && score >= 0.75) return "independent";
  if (score >= 0.6) return "supported";
  return "attempt";
}

function getHistory(profile, canDoId) {
  return (profile.evidence || []).filter((item) => item.canDoId === canDoId);
}

function hasIndependentEvidence(history) {
  return history.filter((item) => item.independent).length;
}

function getStatus(canDo, profile) {
  const history = getHistory(profile, canDo.id);
  if (!history.length) return "notStarted";

  const normalized = history.map(normalizeEvidence);
  const independent = normalized.filter((e) => e.independent && evidenceScore(e) >= 0.75);
  const contexts = new Set(independent.map((e) => e.contextId));
  const latest = normalized[normalized.length - 1];

  if (independent.length >= 2 && contexts.size >= 2) {
    if (latest.level === "transfer" || normalized.some((e) => e.level === "transfer")) {
      return "transferred";
    }
    return "consolidated";
  }

  if (independent.length >= 1) return "functional";
  if (normalized.some((e) => evidenceScore(e) >= 0.6)) return "developing";
  return "emerging";
}

function identifyGap(canDo, evidence) {
  const dimensions = evidence.dimensions || {};
  const candidates = Object.entries(dimensions).sort((a, b) => a[1] - b[1]);

  if (evidence.errors?.length) {
    const priorityError = evidence.errors.find((e) => e.priority === "high" || e.priority === "critical");
    if (priorityError) {
      return {
        type: priorityError.type || "language-resource",
        target: priorityError.target || null,
        reason: priorityError.message || "Priority error detected."
      };
    }
  }

  if (candidates.length && candidates[0][1] < 0.65) {
    return {
      type: candidates[0][0],
      target: null,
      reason: `Weakest evidence dimension: ${candidates[0][0]}`
    };
  }

  if (evidence.confidence > 0 && evidence.confidence <= 2) {
    return {
      type: "confidence",
      target: null,
      reason: "The learner reports very low confidence."
    };
  }

  return { type: "none", target: null, reason: "No actionable gap detected." };
}

function chooseRecovery(canDo, matrix, gap) {
  if (!canDo) return [];

  const candidates = canDo.recovery?.length
    ? canDo.recovery
    : (canDo.prerequisites || []);

  if (gap.target && candidates.includes(gap.target)) return [gap.target];

  return candidates.slice(0, 2).filter((id) => getCanDo(matrix, id));
}

function reviewDelayDays(status, success) {
  if (!success) return 1;

  const index = Math.max(0, STATUS_ORDER.indexOf(status) - 1);
  return DEFAULT_REVIEW_DAYS[Math.min(index, DEFAULT_REVIEW_DAYS.length - 1)];
}

function isReviewDue(item, now = new Date()) {
  if (!item?.nextReviewAt) return false;
  return new Date(item.nextReviewAt) <= now;
}

function priorityScore(canDo, profile, now = new Date()) {
  const priority = { critical: 4, high: 3, medium: 2, low: 1 }[canDo.priority] || 1;
  const status = getStatus(canDo, profile);
  const statusPenalty = {
    notStarted: 3,
    emerging: 2.5,
    developing: 2,
    functional: 1,
    consolidated: 0.25,
    transferred: 0
  }[status];

  const due = (profile.reviews || []).some(
    (review) => review.canDoId === canDo.id && isReviewDue(review, now)
  ) ? 2 : 0;

  return priority + statusPenalty + due;
}

function selectNextCanDo(matrix, profile, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const allowedLevels = options.levels || ["A2", "A2+", "B1"];

  const candidates = (matrix.canDos || [])
    .filter((canDo) => allowedLevels.includes(canDo.level))
    .filter((canDo) => {
      const prerequisites = canDo.prerequisites || [];
      return prerequisites.every((id) => {
        const prerequisite = getCanDo(matrix, id);
        if (!prerequisite) return false;
        const status = getStatus(prerequisite, profile);
        return ["functional", "consolidated", "transferred"].includes(status);
      }) || prerequisites.length === 0;
    })
    .map((canDo) => ({ canDo, score: priorityScore(canDo, profile, now) }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.canDo || null;
}

function registerEvidence(matrix, profile, rawEvidence) {
  const evidence = normalizeEvidence(rawEvidence);
  const canDo = getCanDo(matrix, evidence.canDoId);
  if (!canDo) throw new Error(`Unknown Can-Do: ${evidence.canDoId}`);

  evidence.level = determineEvidenceLevel(evidence);

  const nextProfile = {
    ...profile,
    evidence: [...(profile.evidence || []), evidence],
    reviews: [...(profile.reviews || [])]
  };

  const status = getStatus(canDo, nextProfile);
  const score = evidenceScore(evidence);
  const success = evidence.independent && score >= 0.75;

  const gap = identifyGap(canDo, evidence);
  const recovery = success ? [] : chooseRecovery(canDo, matrix, gap);

  const days = reviewDelayDays(status, success);
  const nextReviewAt = new Date(Date.now() + days * 86400000).toISOString();

  nextProfile.reviews = [
    ...nextProfile.reviews.filter((r) => r.canDoId !== canDo.id),
    { canDoId: canDo.id, nextReviewAt, intervalDays: days }
  ];

  return {
    profile: nextProfile,
    canDo: { id: canDo.id, status, score, evidenceLevel: evidence.level },
    gap,
    recovery,
    retryRequired: !success && canDo.feedback?.requireRetryForPriorityErrors !== false,
    nextReviewAt
  };
}

function createActivityPlan(matrix, profile, canDoId, options = {}) {
  const canDo = getCanDo(matrix, canDoId);
  if (!canDo) throw new Error(`Unknown Can-Do: ${canDoId}`);

  const gap = options.gap || { type: "none", target: null };
  const recovery = gap.type !== "none" ? chooseRecovery(canDo, matrix, gap) : [];

  return {
    id: `activity-${canDo.id}-${Date.now()}`,
    canDoId: canDo.id,
    level: canDo.level,
    skill: canDo.skill,
    objective: canDo.canDo,
    mode: options.mode || canDo.evidence?.type || canDo.skill,
    support: options.support || recovery,
    task: canDo.evidence?.task || canDo.canDo,
    feedbackLanguages: canDo.feedback?.languages || ["en", "es"],
    retryRequired: Boolean(options.retryRequired),
    languageResources: canDo.languageResources || {}
  };
}

function getProgressProfile(matrix, profile) {
  const result = {};
  for (const canDo of matrix.canDos || []) {
    const status = getStatus(canDo, profile);
    result[canDo.id] = {
      skill: canDo.skill,
      level: canDo.level,
      priority: canDo.priority,
      status,
      evidenceCount: getHistory(profile, canDo.id).length
    };
  }
  return result;
}

export {
  STATUS_ORDER,
  EVIDENCE_ORDER,
  normalizeEvidence,
  evidenceScore,
  determineEvidenceLevel,
  getStatus,
  identifyGap,
  chooseRecovery,
  selectNextCanDo,
  registerEvidence,
  createActivityPlan,
  getProgressProfile
};
