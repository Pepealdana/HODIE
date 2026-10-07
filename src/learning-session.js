import {
  selectNextLearningTarget,
  selectNextActivityTarget,
  explainSelection
} from "./adaptive-planner.js";
import { createActivityPlan } from "./activity-generator.js";

const DEFAULT_SESSION_MINUTES = {
  speaking: 8,
  listening: 8,
  reading: 7,
  writing: 8,
  communication: 10,
  vocabulary: 5,
  grammar: 5,
  pronunciation: 5
};

function createSession(matrix, library, profile, options = {}) {
  const planningOptions = {
    levels: options.levels || ["A2", "A2+", "B1"],
    contextTerms: options.contextTerms || [],
    recentEvidenceLimit: options.recentEvidenceLimit || 8,
    recentGapLimit: options.recentGapLimit || 5,
    now: options.now
  };

  const target =
    selectNextActivityTarget(matrix, library, profile, planningOptions) ||
    selectNextLearningTarget(matrix, profile, planningOptions);

  if (!target) {
    throw new Error("No eligible Can-Do is available for the current profile.");
  }

  const rationale = explainSelection(matrix, profile, target, planningOptions);
  const plan = createActivityPlan(matrix, library, target.id, {
    profile,
    gap: options.gap || { type: "none", target: null },
    retryRequired: Boolean(options.retryRequired)
  });

  const minutes =
    options.durationMinutes ||
    DEFAULT_SESSION_MINUTES[target.skill] ||
    7;

  return {
    id: `session-${target.id}-${Date.now()}`,
    version: "1.0.0",
    mode: options.mode || "standard",
    durationMinutes: minutes,
    target: {
      canDoId: target.id,
      skill: target.skill,
      level: target.level,
      statement: target.canDo,
      spanish: target.spanish || null
    },
    why: rationale,
    stages: plan.stages,
    selection: plan.selection,
    completion: {
      evidenceRequired: true,
      retryOnPriorityError:
        target.feedback?.requireRetryForPriorityErrors !== false,
      progressMutation: "register-evidence"
    }
  };
}

export {
  DEFAULT_SESSION_MINUTES,
  createSession
};
