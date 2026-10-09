const BUDGETS = {
  quick: { minutes: 5, microActivities: 3, experienceTurns: 0, reflection: false },
  standard: { minutes: 15, microActivities: 5, experienceTurns: 3, reflection: true },
  deep: { minutes: 30, microActivities: 7, experienceTurns: 5, reflection: true }
};

function getLearningBudget(mode = "standard") {
  return { ...(BUDGETS[mode] || BUDGETS.standard), mode: BUDGETS[mode] ? mode : "standard" };
}

function allocateBudget(mode, priorities = {}) {
  const budget = getLearningBudget(mode);
  const review = Math.min(budget.microActivities, Math.max(0, Number(priorities.review || 0)));
  const production = Math.max(0, budget.microActivities - review);
  return {
    ...budget,
    allocation: {
      review,
      production,
      conversation: budget.experienceTurns > 0 ? 1 : 0,
      reflection: budget.reflection ? 1 : 0
    }
  };
}

export { BUDGETS, getLearningBudget, allocateBudget };
