import { registerEvidence } from "./learning-engine.js";
import { createActivityPlan } from "./activity-generator.js";
import {
  selectNextActivityTarget
} from "./adaptive-planner.js";

/**
 * Integration boundary between evidence registration and activity generation.
 * Kept outside both modules to avoid a circular dependency.
 */
function createNextActivityPlan(matrix, library, result, options = {}) {
  if (!result?.canDo?.id) {
    throw new Error("Evidence result must include a Can-Do.");
  }

  const retry = Boolean(result.retryRequired);
  const target = retry
    ? result.canDo
    : selectNextActivityTarget(matrix, library, result.profile, options);

  if (!target?.id) {
    throw new Error("No activity-backed next Can-Do is available after evidence.");
  }

  return createActivityPlan(matrix, library, target.id, {
    profile: result.profile,
    gap: retry ? result.gap : { type: "none", target: null },
    retryRequired: retry,
    ...options
  });
}

function registerEvidenceAndCreateActivityPlan(matrix, profile, library, rawEvidence, options = {}) {
  const result = registerEvidence(matrix, profile, rawEvidence, options);
  const plan = createNextActivityPlan(matrix, library, result, options);
  return { result, plan };
}

export {
  createNextActivityPlan,
  registerEvidenceAndCreateActivityPlan
};
