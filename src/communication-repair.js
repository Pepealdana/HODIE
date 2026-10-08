const REPAIR_STRATEGIES = {
  clarification: {
    prompt: "Could you say that again?",
    promptEs: "¿Puedes decirlo otra vez?",
    purpose: "Recover when the listener does not understand."
  },
  confirmation: {
    prompt: "Do you mean...?",
    promptEs: "¿Quieres decir...?",
    purpose: "Confirm meaning before continuing."
  },
  reformulation: {
    prompt: "Let me say that another way.",
    promptEs: "Déjame decirlo de otra manera.",
    purpose: "Repair an unclear message without abandoning the interaction."
  },
  continuation: {
    prompt: "The important thing is...",
    promptEs: "Lo importante es...",
    purpose: "Keep communicating when a detail is missing."
  }
};

function chooseRepairStrategy(error = {}) {
  if (error.type === "listening-comprehension") return REPAIR_STRATEGIES.clarification;
  if (error.type === "communication") return REPAIR_STRATEGIES.confirmation;
  if (error.type === "task-completion") return REPAIR_STRATEGIES.continuation;
  return REPAIR_STRATEGIES.reformulation;
}

function buildRepairAction(error, context = {}) {
  const strategy = chooseRepairStrategy(error);
  return {
    type: "repair",
    strategy: Object.entries(REPAIR_STRATEGIES).find(([, value]) => value === strategy)?.[0] || "reformulation",
    prompt: strategy.prompt,
    promptEs: strategy.promptEs,
    contextId: context.contextId || "general",
    target: error.target || error.type || "communication"
  };
}

export { REPAIR_STRATEGIES, chooseRepairStrategy, buildRepairAction };
