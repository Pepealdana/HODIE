const HISTORY_LIMIT = 100;

function recordLearningEvent(profile = {}, event = {}) {
  if (!event.mode) return profile;
  const normalized = {
    id: event.id || `learning-event-${Date.now()}`,
    mode: String(event.mode),
    surface: event.surface || "practice",
    skill: event.skill || inferSkill(event.mode, event.surface),
    canDoId: event.canDoId || null,
    knowledgeIds: Array.isArray(event.knowledgeIds) ? [...new Set(event.knowledgeIds)] : [],
    outcome: event.outcome || "started",
    at: event.at || new Date().toISOString()
  };
  const history = [...(profile.learningHistory || []), normalized].slice(-HISTORY_LIMIT);
  return { ...profile, learningHistory: history };
}

function inferSkill(mode, surface) {
  if (["speaking", "listening", "reading", "writing"].includes(mode)) return mode;
  if (["grammar", "vocabulary", "pronunciation"].includes(mode)) return mode;
  if (surface === "conversation" || surface === "simulation") return "speaking";
  if (mode === "review" || mode === "mixed") return "integrated";
  return "integrated";
}

function summarizeLearningProfile(profile = {}, options = {}) {
  const history = Array.isArray(profile.learningHistory) ? profile.learningHistory : [];
  const limit = options.recentLimit || 12;
  const recent = history.slice(-limit);
  const skillCounts = {};
  const modeCounts = {};
  const resourceCounts = {};
  for (const event of history) {
    skillCounts[event.skill || inferSkill(event.mode, event.surface)] =
      (skillCounts[event.skill || inferSkill(event.mode, event.surface)] || 0) + 1;
    modeCounts[event.mode] = (modeCounts[event.mode] || 0) + 1;
    for (const id of event.knowledgeIds || []) resourceCounts[id] = (resourceCounts[id] || 0) + 1;
  }
  const recentSkillCounts = {};
  for (const event of recent) {
    const skill = event.skill || inferSkill(event.mode, event.surface);
    recentSkillCounts[skill] = (recentSkillCounts[skill] || 0) + 1;
  }
  return {
    totalActivities: history.length,
    recent,
    skillCounts,
    modeCounts,
    resourceCounts,
    recentSkillCounts,
    lastActivityAt: history.at(-1)?.at || null
  };
}

function recommendBalancedMode(profile = {}, availableModes = ["mixed", "speaking", "listening", "writing", "grammar", "vocabulary"], options = {}) {
  const summary = summarizeLearningProfile(profile, options);
  const modes = availableModes.filter(Boolean);
  if (!modes.length) return null;
  const skillForMode = options.skillForMode || {};
  const recent = summary.recent;
  const scores = modes.map((mode, index) => {
    const skill = skillForMode[mode] || inferSkill(mode);
    const recentCount = summary.recentSkillCounts[skill] || 0;
    const totalCount = summary.skillCounts[skill] || 0;
    const lastIndex = recent.map((event) => event.mode).lastIndexOf(mode);
    const recencyBonus = lastIndex < 0 ? 1.5 : Math.min(1.5, (recent.length - lastIndex - 1) * 0.2);
    const score = recentCount * 2 + totalCount * 0.15 - recencyBonus;
    return { mode, score, index };
  });
  scores.sort((a, b) => a.score - b.score || a.index - b.index);
  return scores[0].mode;
}

export { recordLearningEvent, summarizeLearningProfile, recommendBalancedMode, inferSkill };
