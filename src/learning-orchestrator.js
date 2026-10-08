import { getStatus } from "./learning-engine.js";
import { evaluateProgression, getRetentionProfile } from "./progression-retention.js";
import { selectExperiences } from "./experience-engine.js";

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
  const level = options.level ||
    evaluateProgression(matrix, profile, getStatus, options.progressionPolicy).currentLevel;
  const context = options.context || "professional";
  const recentErrors = countRecentErrors(profile, options.recentEvidenceLimit || 6);
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
      reason: retentionNeed
        ? "A previous capacity needs maintenance."
        : "Recent evidence shows gaps that should be reinforced."
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
      reason: "Use the language actively in an open conversation."
    };
  }

  const simulations = selectExperiences(
    experienceLibrary,
    { kind: "simulation", level, context }
  );

  if (simulations.length && level !== "A2") {
    return {
      surface: "simulation",
      experienceId: simulations[0].id,
      level,
      reason: "Practice English in a realistic professional situation."
    };
  }

  return {
    surface: "practice",
    mode: "mixed",
    level,
    reason: "Build a balanced base across skills before the next challenge."
  };
}

export { countRecentErrors, hasRecentSkillEvidence, chooseLearningSurface };
