function collectErrorMemory(profile = {}) {
  const map = new Map();

  for (const evidence of profile.evidence || []) {
    for (const rawError of evidence.errors || []) {
      const key = [
        rawError.type || "unknown",
        rawError.target || rawError.id || "unknown"
      ].join(":");
      const current = map.get(key) || {
        key,
        type: rawError.type || "unknown",
        target: rawError.target || rawError.id || "unknown",
        count: 0,
        lastSeen: null,
        contexts: new Set(),
        examples: []
      };
      current.count += 1;
      current.lastSeen = evidence.timestamp || current.lastSeen;
      if (evidence.contextId) current.contexts.add(evidence.contextId);
      if (rawError.actual && current.examples.length < 3) current.examples.push(rawError.actual);
      map.set(key, current);
    }
  }

  return [...map.values()]
    .map((item) => ({ ...item, contexts: [...item.contexts] }))
    .sort((a, b) => b.count - a.count || String(b.lastSeen).localeCompare(String(a.lastSeen)));
}

function getTopErrors(profile, limit = 5) {
  return collectErrorMemory(profile).slice(0, limit);
}

function getErrorsByType(profile, type) {
  return collectErrorMemory(profile).filter((item) => item.type === type);
}

function isRepeatedError(profile, type, target, threshold = 2) {
  return collectErrorMemory(profile).some((item) =>
    item.type === type && item.target === target && item.count >= threshold
  );
}

export { collectErrorMemory, getTopErrors, getErrorsByType, isRepeatedError };
