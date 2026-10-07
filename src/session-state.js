const SESSION_STATES = [
  "planned",
  "started",
  "awaiting-evidence",
  "completed",
  "retry-required",
  "next"
];

const TRANSITIONS = {
  planned: ["started"],
  started: ["awaiting-evidence"],
  "awaiting-evidence": ["completed"],
  completed: ["retry-required", "next"],
  "retry-required": ["started"],
  next: []
};

function transitionSession(session, nextState) {
  if (!session?.id) throw new Error("Session must include an id.");
  if (!SESSION_STATES.includes(nextState)) {
    throw new Error(`Unknown session state: ${nextState}`);
  }

  const current = session.state || "planned";
  if (!TRANSITIONS[current]?.includes(nextState)) {
    throw new Error(`Invalid session transition: ${current} -> ${nextState}`);
  }

  return {
    ...session,
    state: nextState,
    stateHistory: [
      ...(session.stateHistory || [{ state: current, at: null }]),
      { state: nextState, at: new Date().toISOString() }
    ]
  };
}

function startSession(session) {
  return transitionSession(session, "started");
}

function requestEvidence(session) {
  return transitionSession(session, "awaiting-evidence");
}

function completeSession(session) {
  return transitionSession(session, "completed");
}

function markRetryRequired(session) {
  return transitionSession(session, "retry-required");
}

function markNext(session) {
  return transitionSession(session, "next");
}

export {
  SESSION_STATES,
  TRANSITIONS,
  transitionSession,
  startSession,
  requestEvidence,
  completeSession,
  markRetryRequired,
  markNext
};
