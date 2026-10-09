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

function transitionSession(session, nextState, options = {}) {
  if (!session?.id) throw new Error("Session must include an id.");
  if (!SESSION_STATES.includes(nextState)) {
    throw new Error(`Unknown session state: ${nextState}`);
  }

  const current = session.state || "planned";
  if (!TRANSITIONS[current]?.includes(nextState)) {
    throw new Error(`Invalid session transition: ${current} -> ${nextState}`);
  }

  const at = options.now
    ? new Date(options.now).toISOString()
    : new Date().toISOString();

  return {
    ...session,
    state: nextState,
    stateHistory: [
      ...(session.stateHistory || [{ state: current, at: null }]),
      { state: nextState, at }
    ]
  };
}

function startSession(session, options = {}) {
  return transitionSession(session, "started", options);
}

function requestEvidence(session, options = {}) {
  return transitionSession(session, "awaiting-evidence", options);
}

function completeSession(session, options = {}) {
  return transitionSession(session, "completed", options);
}

function markRetryRequired(session, options = {}) {
  return transitionSession(session, "retry-required", options);
}

function markNext(session, options = {}) {
  return transitionSession(session, "next", options);
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
