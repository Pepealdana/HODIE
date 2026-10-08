const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[.!?,]/g, "").replace(/\s+/g, " ");

function selectMicroActivities(library, { canDoId, mode = "mixed", limit = 6 } = {}) {
  const activities = (library.activities || []).filter((item) => !canDoId || item.canDoId === canDoId);
  if (!activities.length) return [];

  const modeSkill = {
    speaking:"speaking",
    listening:"listening",
    grammar:"grammar",
    vocabulary:"vocabulary",
    reading:"reading",
    writing:"writing"
  }[mode];

  const preferredOrder = ["choose","complete","order","match","listening","speak","mini-production"];
  const mini = activities.find((item) => item.type === "mini-production");
  const filtered = modeSkill
    ? activities.filter((item) => item.skill === modeSkill || item.type === modeSkill)
    : activities;

  const pool = filtered.length ? filtered : activities;
  const ordered = [...pool].sort((a,b) => preferredOrder.indexOf(a.type) - preferredOrder.indexOf(b.type));
  const withoutMini = ordered.filter((item) => item.type !== "mini-production");
  const targetCount = Math.max(1, limit - (mini ? 1 : 0));
  const selected = withoutMini.slice(0, targetCount);

  if (mini && !selected.some((item) => item.id === mini.id)) selected.push(mini);
  return selected.slice(0, limit);
}

function evaluateMicroActivity(activity, response) {
  const value = normalize(response);
  if (activity.type === "choose" || activity.type === "complete" || activity.type === "match" || activity.type === "listening") {
    const accepted = [activity.answer, ...(activity.acceptableAnswers || [])].map(normalize);
    const correct = accepted.includes(value);
    return {
      correct,
      score: correct ? 1 : 0,
      retryRecommended: !correct,
      feedback: correct ? activity.feedback.correct : activity.feedback.incorrect,
      feedbackEs: correct ? activity.feedback.correctEs : activity.feedback.incorrectEs
    };
  }

  if (activity.type === "order") {
    const submitted = Array.isArray(response) ? response.map(normalize) : value.split("|").map(normalize);
    const expected = activity.answer.map(normalize);
    const correct = submitted.length === expected.length && submitted.every((item,index) => item === expected[index]);
    return {
      correct,
      score: correct ? 1 : 0,
      retryRecommended: !correct,
      feedback: correct ? activity.feedback.correct : activity.feedback.incorrect,
      feedbackEs: correct ? activity.feedback.correctEs : activity.feedback.incorrectEs
    };
  }

  if (activity.type === "speak") {
    const tokens = activity.requiredTokens || [];
    const missing = tokens.filter((token) => !value.includes(normalize(token)));
    const correct = missing.length === 0;
    return {
      correct,
      score: correct ? 1 : missing.length < Math.ceil(tokens.length / 2) ? 0.5 : 0,
      retryRecommended: !correct,
      missing,
      feedback: correct ? activity.feedback.correct : activity.feedback.partial,
      feedbackEs: correct ? activity.feedback.correctEs : activity.feedback.partialEs
    };
  }

  if (activity.type === "mini-production") {
    const minimum = activity.requirements?.minResponseCharacters || 0;
    const sufficient = value.length >= minimum;
    return {
      correct: sufficient,
      score: sufficient ? 1 : 0.5,
      retryRecommended: !sufficient,
      feedback: sufficient ? activity.feedback.ready : activity.feedback.short,
      feedbackEs: sufficient ? activity.feedback.readyEs : activity.feedback.shortEs
    };
  }

  throw new Error(`Unsupported micro-activity type: ${activity.type}`);
}

function getModeLabel(mode) {
  const labels = { mixed:"Mixed", speaking:"Speaking", listening:"Listening", grammar:"Grammar", vocabulary:"Vocabulary", reading:"Reading", writing:"Writing", review:"Review" };
  return labels[mode] || "Mixed";
}

export { normalize, selectMicroActivities, evaluateMicroActivity, getModeLabel };
