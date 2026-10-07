/**
 * HODIE Progression & Retention Model v1
 *
 * Sits above the Learning Engine.
 * Responsibilities:
 * - evaluate functional level readiness from Can-Do evidence
 * - keep skill-level profiles separate
 * - schedule maintenance without silently erasing mastery
 * - distinguish current mastery from retention risk
 */

const MASTERY_STATUSES = new Set(["consolidated", "transferred"]);
const COMMUNICATIVE_SKILLS = ["speaking", "listening", "reading", "writing", "communication"];
const LEVELS = ["A2", "A2+", "B1"];

const DEFAULT_POLICY = {
  A2: {
    coverageThreshold: 0.70,
    skillMinimumCoverage: 0.50,
    requireMetaCanDo: true
  },
  "A2+": {
    coverageThreshold: 0.70,
    skillMinimumCoverage: 0.50,
    requireMetaCanDo: false
  },
  B1: {
    coverageThreshold: 0.65,
    skillMinimumCoverage: 0.50,
    requireMetaCanDo: true
  }
};

const RETENTION_INTERVALS_DAYS = {
  notStarted: 1,
  emerging: 1,
  developing: 2,
  functional: 7,
  consolidated: 30,
  transferred: 60
};

function getCanDo(matrix, id) {
  return (matrix.canDos || []).find((item) => item.id === id) || null;
}

function getStatusForCanDo(canDo, profile, getStatus) {
  return getStatus(canDo, profile);
}

function mastered(status) {
  return MASTERY_STATUSES.has(status);
}

function getLevelItems(matrix, level) {
  return (matrix.canDos || []).filter((item) => item.level === level);
}

function getCoverage(items, profile, getStatus) {
  if (!items.length) return 0;
  return items.filter((item) => mastered(getStatusForCanDo(item, profile, getStatus))).length / items.length;
}

function getSkillCoverage(items, profile, getStatus) {
  const result = {};
  for (const skill of COMMUNICATIVE_SKILLS) {
    const skillItems = items.filter((item) => item.skill === skill);
    result[skill] = skillItems.length
      ? getCoverage(skillItems, profile, getStatus)
      : null;
  }
  return result;
}

function getMetaReadiness(items, profile, getStatus) {
  const meta = items.filter((item) => item.canDoType === "meta");
  if (!meta.length) return true;
  return meta.some((item) => mastered(getStatusForCanDo(item, profile, getStatus)));
}

function meetsSkillMinimum(skillCoverage, threshold) {
  return COMMUNICATIVE_SKILLS.every((skill) =>
    skillCoverage[skill] === null || skillCoverage[skill] >= threshold
  );
}

function evaluateLevel(matrix, profile, level, getStatus, policy = DEFAULT_POLICY) {
  const items = getLevelItems(matrix, level);
  const rules = policy[level] || DEFAULT_POLICY.B1;
  const coverage = getCoverage(items, profile, getStatus);
  const skillCoverage = getSkillCoverage(items, profile, getStatus);
  const metaReady = !rules.requireMetaCanDo || getMetaReadiness(items, profile, getStatus);
  const skillMinimumMet = meetsSkillMinimum(skillCoverage, rules.skillMinimumCoverage);

  const ready = Boolean(
    items.length &&
    coverage >= rules.coverageThreshold &&
    skillMinimumMet &&
    metaReady
  );

  return {
    level,
    ready,
    coverage,
    coverageThreshold: rules.coverageThreshold,
    skillCoverage,
    skillMinimumCoverage: rules.skillMinimumCoverage,
    skillMinimumMet,
    metaReady,
    canDoCount: items.length,
    masteredCount: items.filter((item) => mastered(getStatusForCanDo(item, profile, getStatus))).length
  };
}

function evaluateProgression(matrix, profile, getStatus, policy = DEFAULT_POLICY) {
  const levels = LEVELS.map((level) =>
    evaluateLevel(matrix, profile, level, getStatus, policy)
  );

  const a2 = levels.find((item) => item.level === "A2");
  const a2plus = levels.find((item) => item.level === "A2+");
  const b1 = levels.find((item) => item.level === "B1");

  let currentLevel = "A2";
  let readiness = "developing";

  if (b1.ready && a2plus.ready && a2.ready) {
    currentLevel = "B1";
    readiness = "functional";
  } else if (a2plus.ready && a2.ready) {
    currentLevel = "A2+";
    readiness = "functional";
  } else if (a2.ready) {
    currentLevel = "A2";
    readiness = "functional";
  } else if (a2.coverage >= 0.5) {
    currentLevel = "A2";
    readiness = "developing";
  }

  return {
    currentLevel,
    readiness,
    levels,
    nextTargetLevel: currentLevel === "A2" && a2.ready
      ? "A2+"
      : currentLevel === "A2+" && a2plus.ready
        ? "B1"
        : currentLevel === "B1"
          ? "B1"
          : "A2",
    certification: false
  };
}

function getRetentionState(review, now = new Date()) {
  if (!review?.nextReviewAt) {
    return { state: "unscheduled", overdueDays: 0 };
  }

  const dueAt = new Date(review.nextReviewAt);
  if (Number.isNaN(dueAt.getTime())) {
    return { state: "unscheduled", overdueDays: 0 };
  }

  const diffMs = now.getTime() - dueAt.getTime();
  if (diffMs <= 0) {
    return {
      state: "current",
      overdueDays: 0,
      nextReviewAt: review.nextReviewAt
    };
  }

  const overdueDays = Math.ceil(diffMs / 86400000);
  const interval = Math.max(1, Number(review.intervalDays) || 1);
  const state = overdueDays > interval * 2 ? "atRisk" : "due";

  return { state, overdueDays, nextReviewAt: review.nextReviewAt };
}

function getRetentionPlan(status, success = true) {
  if (!success) {
    return {
      intervalDays: RETENTION_INTERVALS_DAYS.developing,
      reason: "failed-or-unsupported-evidence"
    };
  }

  const intervalDays = RETENTION_INTERVALS_DAYS[status] || RETENTION_INTERVALS_DAYS.developing;
  return {
    intervalDays,
    reason: status === "transferred"
      ? "longer maintenance interval after transfer evidence"
      : status === "consolidated"
        ? "maintenance interval after consolidated mastery"
        : "shorter interval while mastery is still developing"
  };
}

function getRetentionProfile(matrix, profile, getStatus, now = new Date()) {
  return (matrix.canDos || []).map((canDo) => {
    const status = getStatus(canDo, profile);
    const review = (profile.reviews || []).find((item) => item.canDoId === canDo.id) || null;
    const retention = getRetentionState(review, now);

    return {
      canDoId: canDo.id,
      skill: canDo.skill,
      level: canDo.level,
      status,
      retentionState: retention.state,
      overdueDays: retention.overdueDays,
      nextReviewAt: retention.nextReviewAt || null,
      recommendedIntervalDays: getRetentionPlan(status, true).intervalDays
    };
  });
}

export {
  MASTERY_STATUSES,
  COMMUNICATIVE_SKILLS,
  LEVELS,
  DEFAULT_POLICY,
  RETENTION_INTERVALS_DAYS,
  getCoverage,
  getSkillCoverage,
  evaluateLevel,
  evaluateProgression,
  getRetentionState,
  getRetentionPlan,
  getRetentionProfile
};
