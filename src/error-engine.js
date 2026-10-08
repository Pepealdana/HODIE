const PRIORITY_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };

function normalizePriority(value) {
  return PRIORITY_ORDER[value] ? value : "medium";
}

function createError({
  activity,
  type,
  target = null,
  actual = null,
  expected = null,
  severity = "medium",
  priority = severity,
  message = "",
  messageEs = "",
  correction = null,
  examples = [],
  retry = true,
  contextId = null
} = {}) {
  const normalizedType = type || activity?.skill || "communication";
  return {
    id: activity?.id ? `ERR-${activity.id}-${normalizedType}-${target || "general"}`.toLowerCase() : `ERR-${normalizedType}-general`,
    type: normalizedType,
    target,
    actual,
    expected,
    severity,
    priority: normalizePriority(priority),
    message,
    messageEs,
    correction,
    examples: Array.isArray(examples) ? examples : [],
    retry: Boolean(retry),
    contextId: contextId || activity?.context || "default"
  };
}

function normalizeErrors(errors = []) {
  return errors.map((error) => ({
    ...error,
    priority: normalizePriority(error.priority),
    severity: error.severity || error.priority || "medium",
    examples: Array.isArray(error.examples) ? error.examples : [],
    retry: error.retry !== false
  }));
}

function prioritizeErrors(errors = [], max = 2) {
  return [...normalizeErrors(errors)]
    .sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
      if (priorityDiff) return priorityDiff;
      const retryDiff = Number(b.retry) - Number(a.retry);
      if (retryDiff) return retryDiff;
      return String(a.type).localeCompare(String(b.type));
    })
    .slice(0, Math.max(1, max));
}

function shouldRetry(errors = []) {
  return normalizeErrors(errors).some((error) =>
    ["critical", "high"].includes(error.priority) || error.type === "task-completion"
  );
}

function evaluateCriteria(criteria = [], response = "") {
  const text = String(response ?? "").trim();
  return criteria.map((criterion) => {
    const patterns = criterion.patterns || [];
    const matched = patterns.some((pattern) => {
      try {
        return new RegExp(pattern, "i").test(text);
      } catch {
        return false;
      }
    });
    return {
      id: criterion.id,
      label: criterion.label,
      matched,
      missingMessage: criterion.missingMessage || "",
      missingMessageEs: criterion.missingMessageEs || ""
    };
  });
}

function buildFeedback(activity, result, errors = [], options = {}) {
  const selected = prioritizeErrors(errors, options.maxPriorityCorrections || 2);
  const success = Boolean(result?.correct) || Number(result?.score) >= 1;

  if (success) {
    return {
      success: true,
      headline: "✓ Good",
      headlineEs: "✓ Bien",
      message: result.feedback || activity?.feedback?.correct || "Good work.",
      messageEs: result.feedbackEs || activity?.feedback?.correctEs || "Buen trabajo.",
      corrections: [],
      retryRecommended: false
    };
  }

  const primary = selected[0];
  const fallbackMessage = result?.feedback || activity?.feedback?.incorrect || "Try again.";
  const fallbackMessageEs = result?.feedbackEs || activity?.feedback?.incorrectEs || "Inténtalo de nuevo.";

  return {
    success: false,
    headline: "Try again",
    headlineEs: "Inténtalo de nuevo",
    message: primary?.message || fallbackMessage,
    messageEs: primary?.messageEs || fallbackMessageEs,
    corrections: selected,
    retryRecommended: shouldRetry(selected) || Boolean(result?.retryRecommended)
  };
}

export {
  PRIORITY_ORDER,
  createError,
  normalizeErrors,
  prioritizeErrors,
  shouldRetry,
  evaluateCriteria,
  buildFeedback
};
