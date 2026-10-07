import { registerEvidence } from "./learning-engine.js";
import { createActivityPlan } from "./activity-generator.js";

/**
 * Integration boundary between evidence registration and activity generation.
 * Kept outside both modules to avoid a circular dependency.
 */
function createNextActivityPlan(matrix, library, result, options = {}) {
  if (!result?.canDo?.id) {
    throw new Error("Evidence result must include a Can-Do.");
  }

  return createActivityPlan(matrix, library, result.canDo.id, {
    profile: result.profile,
    gap: result.gap,
    retryRequired: result.retryRequired,
    ...options
  });
}

function registerEvidenceAndCreateActivityPlan(matrix, profile, library, rawEvidence, options = {}) {
  const result = registerEvidence(matrix, profile, rawEvidence);
  const plan = createNextActivityPlan(matrix, library, result, options);
  return { result, plan };
}

export {
  createNextActivityPlan,
  registerEvidenceAndCreateActivityPlan
};
