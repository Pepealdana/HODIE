import { getStatus } from "./learning-engine.js";
import defaultPolicy from "../data/b2-unlock-policy.json" with { type: "json" };

const MASTERY = new Set(["consolidated", "transferred"]);
const FUNCTIONAL = new Set(["functional", "consolidated", "transferred"]);

function getB2UnlockStatus(matrix = {}, profile = {}, policy = defaultPolicy) {
  const canDos = (matrix.canDos || []).filter((item) => item.level === "B1");
  const requirements = (policy.requirements || []).map((requirement) => {
    const goals = canDos.filter((item) => item.skill === requirement.skill);
    const statuses = goals.map((goal) => ({ id: goal.id, status: getStatus(goal, profile) }));
    const functional = statuses.filter((item) => FUNCTIONAL.has(item.status)).length;
    const consolidated = statuses.filter((item) => MASTERY.has(item.status)).length;
    const met = functional >= requirement.minimumFunctional && consolidated >= requirement.minimumConsolidated;
    return {
      skill: requirement.skill,
      minimumFunctional: requirement.minimumFunctional,
      minimumConsolidated: requirement.minimumConsolidated,
      functional,
      consolidated,
      availableCanDos: goals.length,
      met,
      reason: met ? null : `${requirement.skill}: ${functional}/${requirement.minimumFunctional} functional and ${consolidated}/${requirement.minimumConsolidated} consolidated B1 goals`
    };
  });
  const unmet = requirements.filter((item) => !item.met);
  return {
    level: "B2",
    unlocked: requirements.length > 0 && unmet.length === 0,
    requirements,
    unmet: unmet.map((item) => item.reason),
    policyId: policy.id,
    basis: "local-evidence",
    certification: false
  };
}

export { getB2UnlockStatus };
