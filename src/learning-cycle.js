import { registerEvidence } from "./learning-engine.js";
import { createNextActivityPlan } from "./learning-planner.js";
import { createSession } from "./learning-session.js";

function runLearningCycle(matrix, library, profile, rawEvidence, options = {}) {
  const result = registerEvidence(matrix, profile, rawEvidence);

  const nextSession = result.retryRequired || result.gap.type !== "none"
    ? createNextActivityPlan(matrix, library, result, options)
    : createSession(matrix, library, result.profile, options);

  return {
    result,
    nextSession
  };
}

export {
  runLearningCycle
};
