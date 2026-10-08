import { evaluateCriteria, prioritizeErrors, createError } from "./error-engine.js";

const EXPERIENCE_KINDS = new Set(["conversation", "simulation"]);
const EXPERIENCE_MODES = new Set(["guided-open", "role-play", "presentation"]);

function getExperience(library, id) {
  return (library?.experiences || []).find((item) => item.id === id) || null;
}

function validateExperience(experience) {
  if (!experience?.id) throw new Error("Experience must have an id.");
  if (!EXPERIENCE_KINDS.has(experience.kind)) throw new Error(`Unsupported experience kind: ${experience.kind}`);
  if (!EXPERIENCE_MODES.has(experience.mode)) throw new Error(`Unsupported experience mode: ${experience.mode}`);
  if (!Array.isArray(experience.stages) || !experience.stages.length) throw new Error("Experience must have at least one stage.");
  return true;
}

function selectExperiences(library, { kind = null, level = null, context = null } = {}) {
  return (library?.experiences || []).filter((experience) => {
    if (kind && experience.kind !== kind) return false;
    if (level && !experience.levels?.includes(level)) return false;
    if (context && !experience.contexts?.includes(context)) return false;
    return true;
  });
}

function createExperienceSession(library, id, options = {}) {
  const experience = getExperience(library, id);
  validateExperience(experience);
  return {
    id: options.sessionId || `experience-${id}-${Date.now()}`,
    experienceId: id,
    kind: experience.kind,
    mode: experience.mode,
    index: 0,
    responses: [],
    corrections: [],
    state: "started",
    startedAt: options.now || new Date().toISOString()
  };
}

function evaluateExperienceTurn(experience, stage, response) {
  const text = String(response ?? "").trim();
  const criteria = evaluateCriteria(stage.criteria || [], text);
  const matched = criteria.filter((item) => item.matched);
  const errors = [];

  for (const item of criteria.filter((criterion) => !criterion.matched)) {
    errors.push(createError({
      activity: { id: `${experience.id}-${stage.id}`, context: experience.contexts?.[0] || "general" },
      type: "task-completion",
      target: item.id,
      severity: "low",
      priority: "low",
      message: item.missingMessage || "Try to include this idea.",
      messageEs: item.missingMessageEs || "Intenta incluir esta idea.",
      retry: false
    }));
  }

  const correctionRules = [
    { pattern: /\bI\s+am\s+(teacher|student|programmer|developer|engineer|professor)\b/i, correction: "I am a $1", target: "article", message: 'A singular job normally needs "a/an" after "I am".', messageEs: 'Un trabajo en singular normalmente necesita "a/an" después de "I am".', examples: ["I am a teacher.", "I am an engineer."] },
    { pattern: /\bI\s+enjoy\s+to\s+([a-z]+)\b/i, correction: "I enjoy $1ing", target: "enjoy-ing", message: 'After "enjoy", use the -ing form.', messageEs: 'Después de "enjoy", usamos la forma -ing.', examples: ["I enjoy reading.", "I enjoy building robots."] },
    { pattern: /\bI\s+work\s+on\s+a\s+(school|company|office)\b/i, correction: "I work at a $1", target: "work-place", message: 'For a workplace, "work at" is a natural choice.', messageEs: 'Para un lugar de trabajo, "work at" es una opción natural.', examples: ["I work at a school.", "I work at an office."] }
  ];

  let corrected = text;
  const languageErrors = [];
  for (const rule of correctionRules) {
    const match = corrected.match(rule.pattern);
    if (!match) continue;
    const next = corrected.replace(rule.pattern, rule.correction);
    languageErrors.push(createError({
      activity: { id: `${experience.id}-${stage.id}`, context: experience.contexts?.[0] || "general" },
      type: "grammar",
      target: rule.target,
      actual: match[0],
      expected: rule.correction,
      severity: "low",
      priority: "low",
      message: rule.message,
      messageEs: rule.messageEs,
      correction: next,
      examples: rule.examples,
      retry: false
    }));
    corrected = next;
    if (languageErrors.length >= 2) break;
  }

  const allErrors = prioritizeErrors([...errors, ...languageErrors], 2);
  const responseProvided = text.length > 0;
  const score = !responseProvided ? 0 : Math.min(1, 0.6 + (matched.length / Math.max(1, criteria.length)) * 0.4);

  return {
    responseProvided,
    criteria,
    matched,
    missing: criteria.filter((item) => !item.matched).map((item) => item.id),
    errors: allErrors,
    corrections: prioritizeErrors(languageErrors, 2),
    correctedText: corrected,
    score,
    canContinue: responseProvided,
    retryRecommended: false
  };
}

function advanceExperienceSession(session, turnResult) {
  if (!session || session.state !== "started") throw new Error("Experience session is not active.");
  if (!turnResult?.canContinue) return { ...session };
  return {
    ...session,
    index: session.index + 1,
    responses: [...session.responses, turnResult],
    corrections: [...session.corrections, ...(turnResult.corrections || [])]
  };
}

function isExperienceComplete(experience, session) {
  return Boolean(session && session.index >= experience.stages.length);
}

function summarizeExperience(experience, session) {
  const turns = session.responses || [];
  const scores = turns.map((turn) => turn.score).filter((score) => Number.isFinite(score));
  return {
    experienceId: experience.id,
    turns: turns.length,
    totalTurns: experience.stages.length,
    averageScore: scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0,
    corrections: session.corrections || [],
    completed: turns.length >= experience.stages.length
  };
}

export {
  EXPERIENCE_KINDS,
  EXPERIENCE_MODES,
  getExperience,
  validateExperience,
  selectExperiences,
  createExperienceSession,
  evaluateExperienceTurn,
  advanceExperienceSession,
  isExperienceComplete,
  summarizeExperience
};