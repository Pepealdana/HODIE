const STRONG_STATUSES = new Set(["consolidated", "transferred"]);

function getEvidenceForCanDo(profile = {}, canDoId) {
  return (profile.evidence || []).filter((evidence) => evidence.canDoId === canDoId);
}

function getContextCoverage(profile = {}, canDoId) {
  const evidence = getEvidenceForCanDo(profile, canDoId);
  return [...new Set(evidence.filter((item) => item.independent).map((item) => item.contextId).filter(Boolean))];
}

function evaluateTransfer(profile = {}, canDoId) {
  const evidence = getEvidenceForCanDo(profile, canDoId);
  const contexts = getContextCoverage(profile, canDoId);
  const independent = evidence.filter((item) => item.independent);
  const transferred = independent.filter((item) => item.transfer === true);

  return {
    canDoId,
    evidenceCount: evidence.length,
    independentCount: independent.length,
    contextCount: contexts.length,
    contexts,
    transferEvidenceCount: transferred.length,
    readyForTransfer: contexts.length >= 2 && independent.length >= 2,
    transferred: transferred.length > 0
  };
}

function evaluateTransferPortfolio(matrix, profile = {}, statusResolver) {
  const resolver = statusResolver || (() => "notStarted");
  return (matrix.canDos || [])
    .filter((canDo) => STRONG_STATUSES.has(resolver(canDo, profile)))
    .map((canDo) => evaluateTransfer(profile, canDo.id));
}

export { STRONG_STATUSES, getEvidenceForCanDo, getContextCoverage, evaluateTransfer, evaluateTransferPortfolio };
