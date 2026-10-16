import { getStatus, evidenceScore } from "./learning-engine.js";
import { evaluateProgression } from "./progression-retention.js";

const MASTERY = new Set(["consolidated", "transferred"]);
const CORE_SKILLS = ["speaking", "listening", "reading", "writing", "communication"];
const B2_POLICY = {
  a1Coverage: 0.70,
  b1Coverage: 0.75,
  coreSkillCoverage: 0.60,
  requiredTransferCanDos: 2,
  requiredTransferContexts: 2
};

function coverage(items, profile) {
  if (!items.length) return 0;
  return items.filter((item) => MASTERY.has(getStatus(item, profile))).length / items.length;
}

function skillCoverage(items, profile) {
  return Object.fromEntries(CORE_SKILLS.map((skill) => {
    const subset = items.filter((item) => item.skill === skill);
    return [skill, subset.length ? coverage(subset, profile) : null];
  }));
}

function evaluateB2Unlock(matrix, profile = {}, policy = B2_POLICY) {
  const canDos = matrix?.canDos || [];
  const a1 = canDos.filter((item) => item.level === "A1");
  const b1 = canDos.filter((item) => item.level === "B1");
  const a1Coverage = coverage(a1, profile);
  const b1Coverage = coverage(b1, profile);
  const a1Skills = skillCoverage(a1, profile);
  const b1Skills = skillCoverage(b1, profile);
  const progression = evaluateProgression(matrix, profile, getStatus);
  const progressionReady = ["A2", "A2+", "B1"].every((level) =>
    progression.levels.some((item) => item.level === level && item.ready)
  );

  const transferEvidence = (profile.evidence || []).filter((item) =>
    item.level === "transfer" || item.transfer === true
  ).filter((item) => {
    const target = canDos.find((canDo) => canDo.id === item.canDoId);
    return target?.level === "B1" &&
      item.independent === true &&
      Number(item.confidence) >= 4 &&
      evidenceScore(item) >= 0.75;
  });
  const transferCanDos = new Set(transferEvidence.map((item) => item.canDoId));
  const transferContexts = new Set(transferEvidence.map((item) => item.contextId || "default");
  const transferReady = transferCanDos.size >= policy.requiredTransferCanDos &&
    transferContexts.size >= policy.requiredTransferContexts;

  const a1Ready = a1.length > 0 && a1Coverage >= policy.a1Coverage &&
    CORE_SKILLS.every((skill) => a1Skills[skill] === null || a1Skills[skill] >= 0.5);
  const b1Ready = b1.length > 0 && b1Coverage >= policy.b1Coverage &&
    CORE_SKILLS.every((skill) => b1Skills[skill] === null || b1Skills[skill] >= policy.coreSkillCoverage);
  const reasons = [];
  if (!a1Ready) reasons.push("Strengthen A1 foundations across the core skills.");
  if (!progressionReady) reasons.push("Demonstrate readiness for A2, A2+ and B1 through Can-Do evidence.");
  if (!b1Ready) reasons.push("Reach the B1 mastery threshold overall and in each core skill.");
  if (!transferReady) reasons.push("Show successful independent transfer in at least two B1 Can-Dos and two contexts.");

  return {
    gateId: "B2-READINESS-V1",
    unlocked: a1Ready && progressionReady && b1Ready && transferReady,
    policy: { ...policy },
    a1: { coverage: a1Coverage, threshold: policy.a1Coverage, canDoCount: a1.length, skillCoverage: a1Skills, ready: a1Ready },
    progression: { currentLevel: progression.currentLevel, readiness: progression.readiness, levels: progression.levels },
    b1: { coverage: b1Coverage, threshold: policy.b1Coverage, canDoCount: b1.length, masteredCount: b1.filter((item) => MASTERY.has(getStatus(item, profile))).length, skillCoverage: b1Skills, skillThreshold: policy.coreSkillCoverage, ready: b1Ready },
    transfer: { canDoCount: transferCanDos.size, contextCount: transferContexts.size, requiredCanDos: policy.requiredTransferCanDos, requiredContexts: policy.requiredTransferContexts, ready: transferReady },
    reasons
  };
}

export { B2_POLICY, evaluateB2Unlock };
