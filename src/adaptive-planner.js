import { getStatus } from "./learning-engine.js";
import {
  evaluateProgression,
  getRetentionProfile
} from "./progression-retention.js";

/**
 * HODIE Adaptive Planner v1
 *
 * Answers: "What should the learner do next?"
 * It ranks eligible Can-Dos using pedagogical need, priority, review state,
 * skill balance and learner context. It does not generate activities itself.
 */

const PRIORITY_WEIGHTS = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1
};

const STATUS_NEED = {
  notStarted: 3,
  emerging: 3.2,
  developing: 2.4,
  functional: 1.2,
  consolidated: 0.4,
  transferred: 0
};

const SKILL_WEIGHTS = {
  speaking: 1.4,
  listening: 1.3,
  communication: 1.3,
  reading: 1,
  writing: 1,
  vocabulary: 0.7,
  grammar: 0.6,
  pronunciation: 0.6
};

const COMMUNICATIONAL_SKILLS = new Set([
  "speaking",
  "listening",
  "reading",
  "writing",
  "communication"
]);

function getCanDo(matrix, id) {
  return (matrix.canDos || []).find((item) => item.id === id) || null;
}

function isDue(profile, canDoId, now) {
  return (profile.reviews || []).some((review) =>
    review.canDoId === canDoId &&
    review.nextReviewAt &&
    new Date(review.nextReviewAt) <= now
  );
}

function getRecentEvidence(profile, limit = 8) {
  return (profile.evidence || []).slice(-limit);
}

function hasRecentGap(profile, canDoId, limit = 5) {
  return getRecentEvidence(profile, limit).some((evidence) =>
    evidence.canDoId === canDoId &&
    Array.isArray(evidence.errors) &&
    evidence.errors.length > 0
  );
}

function contextMatch(canDo, contextTerms = []) {
  if (!contextTerms.length) return 0;

  const haystack = [
    canDo.canDo,
    canDo.spanish,
    ...(canDo.languageResources?.vocabulary || []),
    ...(canDo.languageResources?.grammar || []),
    ...(canDo.languageResources?.connectors || [])
  ].join(" ").toLowerCase();

  const matches = contextTerms.filter((term) =>
    haystack.includes(String(term).toLowerCase())
  );

  return matches.length ? Math.min(1.5, matches.length * 0.5) : 0;
}

function prerequisiteReady(matrix, profile, canDo) {
  return (canDo.prerequisites || []).every((id) => {
    const prerequisite = getCanDo(matrix, id);
    if (!prerequisite) return false;

    return [
      "functional",
      "consolidated",
      "transferred"
    ].includes(getStatus(prerequisite, profile));
  });
}

function skillBalancePenalty(matrix, skill, recentEvidence) {
  if (!recentEvidence.length) return 0;

  const recentCount = recentEvidence.filter((evidence) => {
    const canDo = getCanDo(matrix, evidence.canDoId);
    return canDo?.skill === skill;
  }).length;

  return Math.min(1.5, recentCount * 0.35);
}


function progressionBonus(profile, canDo) {
  const recent = profile.evidence?.[profile.evidence.length - 1];
  if (!recent?.canDoId) return 0;

  const followsRecent = (canDo.prerequisites || []).includes(recent.canDoId);
  return followsRecent ? 2.5 : 0;
}

function getProgressionContext(matrix, profile, options = {}) {
  return evaluateProgression(
    matrix,
    profile,
    getStatus,
    options.progressionPolicy
  );
}

function getRetentionEntry(matrix, profile, canDoId, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  return getRetentionProfile(matrix, profile, getStatus, now)
    .find((item) => item.canDoId === canDoId) || null;
}

function retentionBonus(retention) {
  if (!retention) return 0;
  if (!["consolidated", "transferred"].includes(retention.status)) return 0;
  if (retention.retentionState === "atRisk") return 4;
  if (retention.retentionState === "due") return 3;
  return 0;
}

function progressionFitBonus(progression, canDo) {
  if (!progression) return 0;
  if (canDo.level === progression.nextTargetLevel) return 2;
  if (canDo.level === progression.currentLevel) return 0.5;
  return 0;
}

function calculateTargetScore(matrix, profile, canDo, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const status = getStatus(canDo, profile);
  const recentEvidence = getRecentEvidence(profile, options.recentEvidenceLimit || 8);

  let score = PRIORITY_WEIGHTS[canDo.priority] || 1;
  score += STATUS_NEED[status] || 0;
  score *= SKILL_WEIGHTS[canDo.skill] || 1;

  const progression = getProgressionContext(matrix, profile, options);
  const retention = getRetentionEntry(matrix, profile, canDo.id, options);

  if (isDue(profile, canDo.id, now)) score += 3;
  if (hasRecentGap(profile, canDo.id, options.recentGapLimit || 5)) score += 2;

  score += contextMatch(canDo, options.contextTerms || []);
  score += progressionBonus(profile, canDo);
  score += progressionFitBonus(progression, canDo);
  score += retentionBonus(retention);
  score -= skillBalancePenalty(matrix, canDo.skill, recentEvidence);

  if (status === "transferred") score -= 2;
  if (status === "consolidated" && !isDue(profile, canDo.id, now)) score -= 0.5;

  return Math.max(0, score);
}

function rankLearningTargets(matrix, profile, options = {}) {
  const allowedLevels = options.levels || ["A2", "A2+", "B1"];
  const candidates = (matrix.canDos || [])
    .filter((canDo) => allowedLevels.includes(canDo.level))
    .filter((canDo) => prerequisiteReady(matrix, profile, canDo))
    .map((canDo) => ({
      canDo,
      status: getStatus(canDo, profile),
      score: calculateTargetScore(matrix, profile, canDo, options)
    }))
    .sort((a, b) => b.score - a.score);

  return candidates;
}

function selectNextLearningTarget(matrix, profile, options = {}) {
  return rankLearningTargets(matrix, profile, options)[0]?.canDo || null;
}

function selectNextActivityTarget(matrix, library, profile, options = {}) {
  const availableIds = new Set(
    (library.activities || []).map((activity) => activity.canDoId)
  );

  return rankLearningTargets(matrix, profile, options)
    .find((candidate) => availableIds.has(candidate.canDo.id))?.canDo || null;
}

function explainSelection(matrix, profile, canDo, options = {}) {
  if (!canDo) return null;

  const now = options.now ? new Date(options.now) : new Date();
  const status = getStatus(canDo, profile);
  const progression = getProgressionContext(matrix, profile, options);
  const retention = getRetentionEntry(matrix, profile, canDo.id, options);
  const reasons = [];

  if (["critical", "high"].includes(canDo.priority)) {
    reasons.push("high-priority Can-Do");
  }

  if (["notStarted", "emerging", "developing"].includes(status)) {
    reasons.push("skill still developing");
  }

  if (isDue(profile, canDo.id, now)) {
    reasons.push("review is due");
  }

  if (retention?.retentionState === "atRisk") {
    reasons.push("retention is at risk");
  } else if (retention?.retentionState === "due") {
    reasons.push("maintenance review is due");
  }

  if (progression?.nextTargetLevel === canDo.level) {
    reasons.push("supports the next progression target");
  }

  if (hasRecentGap(profile, canDo.id, options.recentGapLimit || 5)) {
    reasons.push("recent evidence shows a gap");
  }

  if (contextMatch(canDo, options.contextTerms || []) > 0) {
    reasons.push("matches the learner's real-life context");
  }

  const recent = profile.evidence?.[profile.evidence.length - 1];
  if (recent?.canDoId && (canDo.prerequisites || []).includes(recent.canDoId)) {
    reasons.push("continues from the most recent Can-Do");
  }

  return {
    canDoId: canDo.id,
    skill: canDo.skill,
    status,
    reasons
  };
}

export {
  PRIORITY_WEIGHTS,
  STATUS_NEED,
  SKILL_WEIGHTS,
  progressionBonus,
  calculateTargetScore,
  rankLearningTargets,
  selectNextLearningTarget,
  selectNextActivityTarget,
  explainSelection,
  getProgressionContext,
  getRetentionEntry,
  retentionBonus,
  progressionFitBonus
};
