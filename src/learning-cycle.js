import { registerEvidence } from "./learning-engine.js";
import { createSession, createSessionForCanDo } from "./learning-session.js";

function runLearningCycle(matrix, library, profile, rawEvidence, options = {}) {
  const result = registerEvidence(matrix, profile, rawEvidence, options);

  const nextSession = result.retryRequired
    ? createSessionForCanDo(matrix, library, result.profile, result.canDo.id, {
        ...options,
        gap: result.gap,
        retryRequired: result.retryRequired
      })
    : createSession(matrix, library, result.profile, options);

  return {
    result,
    nextSession
  };
}

export {
  runLearningCycle
};
