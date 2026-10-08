function getContext(library, id) {
  return (library?.contexts || []).find((context) => context.id === id) || null;
}

function normalizeTerms(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.toLowerCase());
  if (typeof value === "string") return value.toLowerCase().split(/[,\s]+/).filter(Boolean);
  return [];
}

function scoreContextMatch(context, terms = []) {
  if (!context) return 0;
  const haystack = [
    context.id,
    context.label,
    ...(context.tags || [])
  ].join(" ").toLowerCase();
  return normalizeTerms(terms).reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
}

function selectLearningContext(library, terms = [], preferredId = null) {
  if (preferredId && getContext(library, preferredId)) return getContext(library, preferredId);
  return [...(library?.contexts || [])]
    .map((context) => ({ context, score: scoreContextMatch(context, terms) }))
    .sort((a, b) => b.score - a.score || a.context.id.localeCompare(b.context.id))[0]?.context || null;
}

function getContextTags(library, id) {
  return getContext(library, id)?.tags || [];
}

export { getContext, scoreContextMatch, selectLearningContext, getContextTags };
