import { getStatus } from "./learning-engine.js";
import { evaluateProgression, getRetentionProfile } from "./progression-retention.js";
import { selectExperiences } from "./experience-engine.js";
import { getTopErrors } from "./error-memory.js";
import { selectLearningContext } from "./learning-context.js";

function countRecentErrors(profile = {}, limit = 6) {
  return (profile.evidence || []).slice(-limit).reduce(
    (count, evidence) => count + (Array.isArray(evidence.errors) ? evidence.errors.length : 0),
    0
  );
}

function hasRecentSkillEvidence(profile = {}, skill, limit = 6) {
  return (profile.evidence || []).slice(-limit).some((evidence) =>
    evidence.skill === skill || evidence.dimensions?.[skill]
  );
}

function chooseLearningSurface(matrix, experienceLibrary, profile = {}, options = {}) {
  const progression = evaluateProgression(matrix, profile, getStatus, options.progressionPolicy);
  const level = options.level || progression.currentLevel;
  const contextLibrary = options.contextLibrary || null;
  const selectedContext = selectLearningContext(
    contextLibrary,
    options.contextTerms || [options.context || "professional"],
    options.context || null
  );
  const context = selectedContext?.id || options.context || "professional";
  const recentErrors = countRecentErrors(profile, options.recentEvidenceLimit || 6);
  const topErrors = getTopErrors(profile, 3);
  const retention = getRetentionProfile(
    matrix,
    profile,
    getStatus,
    options.now ? new Date(options.now) : new Date()
  );
  const retentionNeed = retention.some((item) =>
    ["due", "atRisk"].includes(item.retentionState)
  );

  if (recentErrors >= 2 || retentionNeed) {
    return {
      surface: "practice",
      mode: "review",
      level,
      context,
      reason: retentionNeed
        ? "A previous capacity needs maintenance."
        : "Recent evidence shows gaps that should be reinforced.",
      errors: topErrors
    };
  }

  const conversation = selectExperiences(
    experienceLibrary,
    { kind: "conversation", level, context }
  )[0];

  if (conversation && (hasRecentSkillEvidence(profile, "speaking") || !profile.evidence?.length)) {
    return {
      surface: "conversation",
      experienceId: conversation.id,
      level,
      context,
      reason: "Use the language actively in an open conversation."
    };
  }

  const simulations = selectExperiences(
    experienceLibrary,
    { kind: "simulation", level, context }
  );

  if (simulations.length) {
    return {
      surface: "simulation",
      experienceId: simulations[0].id,
      level,
      context,
      reason: progression.currentLevel === "A2"
        ? "Practice a realistic situation with the support appropriate for your current level."
        : "Practice English in a realistic professional situation."
    };
  }

  return {
    surface: "practice",
    mode: "mixed",
    level,
    context,
    reason: "Build a balanced base across skills before the next challenge."
  };
}

export { countRecentErrors, hasRecentSkillEvidence, chooseLearningSurface };
