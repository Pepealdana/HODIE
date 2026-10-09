import { createSession, createSessionForCanDo } from "./learning-session.js";
import { completeSession, markNext, markRetryRequired } from "./session-state.js";
import { submitSessionEvidence } from "./evidence-boundary.js";

function runSessionEvidenceCycle(
  matrix,
  library,
  profile,
  session,
  rawEvidence,
  options = {}
) {
  const completedSession =
    session.state === "awaiting-evidence"
      ? completeSession(session, options)
      : session;

  const result = submitSessionEvidence(
    matrix,
    library,
    completedSession,
    profile,
    rawEvidence,
    options
  );

  const finalSession = result.retryRequired
    ? markRetryRequired(completedSession, options)
    : markNext(completedSession, options);

  const nextSession = result.retryRequired
    ? createSessionForCanDo(
        matrix,
        library,
        result.profile,
        result.canDo.id,
        {
          ...options,
          gap: result.gap,
          retryRequired: true,
          mode: "recovery"
        }
      )
    : createSession(matrix, library, result.profile, options);

  return {
    result,
    session: finalSession,
    nextSession
  };
}

export {
  runSessionEvidenceCycle
};
