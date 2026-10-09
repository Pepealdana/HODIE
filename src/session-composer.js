import { allocateBudget } from "./learning-budget.js";
import { selectMicroActivities } from "./micro-practice.js";

function composeLearningSession({
  matrix,
  microLibrary,
  experienceLibrary,
  profile = {},
  mode = "standard",
  canDoId = null,
  context = "professional"
} = {}) {
  const budget = allocateBudget(mode, {
    review: (profile.evidence || []).slice(-6).reduce(
      (count, evidence) => count + (Array.isArray(evidence.errors) && evidence.errors.length ? 1 : 0),
      0
    )
  });

  const activities = canDoId
    ? selectMicroActivities(microLibrary, { canDoId, mode: "mixed", limit: budget.microActivities, profile })
    : [];

  const conversations = (experienceLibrary?.experiences || []).filter((item) =>
    item.kind === "conversation" &&
    item.contexts?.includes(context)
  );

  return {
    mode: budget.mode,
    budget,
    context,
    canDoId,
    practice: activities,
    conversation: conversations[0] || null,
    evidenceBoundary: "Only explicit assessment activities can mutate progress."
  };
}

export { composeLearningSession };
