function collectErrorMemory(profile = {}) {
  const map = new Map();
  const sources = [
    ...(Array.isArray(profile.evidence) ? profile.evidence.map((item) => ({ ...item, source: "evidence" })) : []),
    ...(Array.isArray(profile.knowledgeEvidence) ? profile.knowledgeEvidence.map((item) => ({
      ...item,
      timestamp: item.at || item.timestamp || null,
      contextId: item.contextId || item.activityId || null,
      source: "knowledgeEvidence"
    })) : [])
  ];

  for (const evidence of sources) {
    const seenInRecord = new Set();
    for (const rawError of evidence.errors || []) {
      const target = rawError.ruleId || rawError.target || rawError.id || "unknown";
      const type = rawError.type || "unknown";
      const key = [type, target].join(":");
      // One occurrence of the same rule within a single evidence record counts once.
      const occurrenceKey = [key, rawError.actual || "", rawError.expected || ""].join("|");
      if (seenInRecord.has(occurrenceKey)) continue;
      seenInRecord.add(occurrenceKey);

      const current = map.get(key) || {
        key,
        type,
        target,
        count: 0,
        lastSeen: null,
        contexts: new Set(),
        surfaces: new Set(),
        examples: []
      };
      current.count += 1;
      const timestamp = evidence.timestamp || evidence.at || null;
      if (!current.lastSeen || (timestamp && String(timestamp) > String(current.lastSeen))) current.lastSeen = timestamp;
      if (evidence.contextId) current.contexts.add(evidence.contextId);
      if (evidence.surface) current.surfaces.add(evidence.surface);
      if (rawError.actual && current.examples.length < 3 && !current.examples.includes(rawError.actual)) {
        current.examples.push(rawError.actual);
      }
      map.set(key, current);
    }
  }

  return [...map.values()]
    .map((item) => ({
      ...item,
      contexts: [...item.contexts],
      surfaces: [...item.surfaces]
    }))
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
