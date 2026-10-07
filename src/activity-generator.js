import { chooseRecovery, identifyGap, getStatus } from "./learning-engine.js";

function getCanDo(matrix, id) {
  return (matrix.canDos || []).find((item) => item.id === id) || null;
}

function resourceValues(canDo) {
  const resources = canDo?.languageResources || {};
  return Object.entries(resources).flatMap(([type, values]) =>
    (values || []).map((value) => ({ type, value: String(value).toLowerCase() }))
  );
}

function findContent(library, canDoId, preferredTypes = []) {
  const matches = (library.activities || []).filter((item) => item.canDoId === canDoId);
  if (!matches.length) return null;
  if (!preferredTypes.length) return matches[0];
  return matches.find((item) => preferredTypes.includes(item.activityType)) || matches[0];
}

function findResourceActivity(library, matrix, gap) {
  if (!gap?.target) return null;
  const target = String(gap.target).toLowerCase();

  return (library.activities || []).find((activity) => {
    const canDo = getCanDo(matrix, activity.canDoId);
    return resourceValues(canDo).some((resource) =>
      resource.value === target
    ) && ["recognition", "controlled-practice", "pronunciation"].includes(activity.activityType);
  }) || null;
}

function createSyntheticRecovery(canDo, gap) {
  return {
    id: `RECOVERY-${canDo.id}-${String(gap.target || gap.type).toUpperCase()}`,
    canDoId: canDo.id,
    activityType: "controlled-practice",
    level: canDo.level,
    skill: canDo.skill,
    title: `Practice: ${gap.target || gap.type}`,
    objective: `Strengthen ${gap.target || gap.type} before retrying the original task.`,
    instructions: "Practice the target language and then use it in a short meaningful response.",
    task: `Use "${gap.target || gap.type}" in three short English examples related to the original situation.`,
    generated: true,
    evidence: {
      dimensions: {},
      independent: false
    },
    feedback: {
      languages: ["en", "es"],
      maxPriorityCorrections: 2
    },
    retry: {
      requiredAfterPriorityError: true,
      preserveOriginalTask: true
    }
  };
}

function createActivityPlan(matrix, library, canDoId, options = {}) {
  const canDo = getCanDo(matrix, canDoId);
  if (!canDo) throw new Error(`Unknown Can-Do: ${canDoId}`);

  const gap = options.gap || { type: "none", target: null };
  const preferredTypes = options.preferredActivityTypes || (
    canDo.canDoType === "interaction"
      ? ["interaction", "guided-production"]
      : canDo.skill === "listening"
        ? ["listening-comprehension"]
        : canDo.skill === "reading"
          ? ["reading-comprehension"]
          : canDo.skill === "writing"
            ? ["guided-production", "independent-production"]
            : ["guided-production", "independent-production", "interaction"]
  );

  const original = findContent(library, canDoId, preferredTypes) || findContent(library, canDoId);
  if (!original) {
    throw new Error(`No content activity found for Can-Do: ${canDoId}`);
  }

  const recoveryIds = gap.type === "none" ? [] : chooseRecovery(canDo, matrix, gap);
  const recoveryActivities = [];

  if (gap.type !== "none") {
    const targeted = findResourceActivity(library, matrix, gap);
    if (targeted) recoveryActivities.push(targeted);
    else if (gap.target) recoveryActivities.push(createSyntheticRecovery(canDo, gap));

    if (!recoveryActivities.length) {
      for (const recoveryId of recoveryIds) {
        const activity = findContent(library, recoveryId, ["controlled-practice", "recognition", "guided-production"]);
        if (activity) recoveryActivities.push(activity);
      }
    }
  }

  return {
    canDoId,
    status: getStatus(canDo, options.profile || { evidence: [] }),
    gap,
    stages: [
      ...recoveryActivities.map((activity) => ({
        kind: "recovery",
        activity,
        required: true
      })),
      {
        kind: "target",
        activity: original,
        required: true
      },
      ...(options.retryRequired ? [{
        kind: "retry",
        activity: original,
        required: true
      }] : [])
    ],
    selection: {
      source: original.generated ? "generated" : "library",
      recoveryGenerated: recoveryActivities.some((activity) => activity.generated === true)
    }
  };
}

function generateFromEvidence(matrix, library, canDoId, evidence, options = {}) {
  const canDo = getCanDo(matrix, canDoId);
  if (!canDo) throw new Error(`Unknown Can-Do: ${canDoId}`);
  const gap = identifyGap(canDo, evidence);
  return createActivityPlan(matrix, library, canDoId, {
    ...options,
    gap,
    retryRequired: gap.type !== "none"
  });
}

export {
  createActivityPlan,
  generateFromEvidence
};
