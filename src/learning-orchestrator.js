import { getStatus } from "./learning-engine.js";
import { evaluateProgression, getRetentionProfile } from "./progression-retention.js";
import { selectExperiences } from "./experience-engine.js";
import { getTopErrors } from "./error-memory.js";
import { selectLearningContext } from "./learning-context.js";
import { recommendBalancedMode } from "./learning-profile.js";

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

  const history = Array.isArray(profile.learningHistory) ? profile.learningHistory : [];
  const recentModes = history.slice(-4).map((event) => event.mode);
  const repeatedFocus = recentModes.length >= 3 &&
    recentModes.every((mode) => mode === recentModes[0]) &&
    ["speaking", "listening", "writing", "grammar", "vocabulary"].includes(recentModes[0]);

  if (repeatedFocus) {
    const balancedMode = recommendBalancedMode(profile, options.availableModes || ["mixed", "speaking", "listening", "writing", "grammar", "vocabulary"]);
    if (balancedMode && balancedMode !== recentModes[0]) {
      return {
        surface: "practice",
        mode: balancedMode,
        level,
        context,
        reason: "You have practised " + recentModes[0] + " several times in a row. This activity adds variety and helps transfer knowledge to another skill.",
        balance: { previousMode: recentModes[0], recommendedMode: balancedMode },
        connectedKnowledge: (options.knowledgeGraph?.nodes || []).filter((node) => node.canDoIds?.some((id) => history.slice(-4).some((event) => event.canDoId === id))).map((node) => node.id)
      };
    }
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
