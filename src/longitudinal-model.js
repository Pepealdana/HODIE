import { getTopErrors } from "./error-memory.js";
import { evaluateTransfer } from "./transfer-engine.js";

function buildLongitudinalProfile(matrix, profile = {}, statusResolver) {
  const evidence = [...(profile.evidence || [])].sort((a, b) =>
    String(a.timestamp || "").localeCompare(String(b.timestamp || ""))
  );
  const canDoIds = [...new Set(evidence.map((item) => item.canDoId).filter(Boolean))];
  const skills = {};

  for (const evidenceItem of evidence) {
    const canDo = (matrix.canDos || []).find((item) => item.id === evidenceItem.canDoId);
    if (!canDo) continue;
    skills[canDo.skill] = skills[canDo.skill] || { evidence: 0, canDos: new Set() };
    skills[canDo.skill].evidence += 1;
    skills[canDo.skill].canDos.add(canDo.id);
  }

  const skillSummary = Object.fromEntries(Object.entries(skills).map(([skill, value]) => [
    skill,
    { evidence: value.evidence, canDos: value.canDos.size }
  ]));

  const transfers = canDoIds.map((canDoId) => evaluateTransfer(profile, canDoId));
  const status = canDoIds.map((canDoId) => {
    const canDo = (matrix.canDos || []).find((item) => item.id === canDoId);
    return canDo ? { canDoId, status: statusResolver ? statusResolver(canDo, profile) : "unknown" } : null;
  }).filter(Boolean);

  return {
    evidenceCount: evidence.length,
    firstEvidenceAt: evidence[0]?.timestamp || null,
    lastEvidenceAt: evidence.at(-1)?.timestamp || null,
    activeCanDos: canDoIds.length,
    skillSummary,
    strongestErrors: getTopErrors(profile, 5),
    transfers,
    status
  };
}

export { buildLongitudinalProfile };
